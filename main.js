const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')

const mysql = require('mysql2/promise')

class ModuleInstance extends InstanceBase {
	isInitialized = false
	requests = new Map()
	lastError = 0 // timestamp of last sql error

	FORMATS = [
		{ id: 'first', label: 'First field of first row' },
		{ id: 'json', label: 'JSON string' },
		{ id: 'array', label: 'Array' },
		{ id: 'object', label: 'Object' },
	]

	constructor(internal) {
		super(internal)
	}

	async init(config) {
		await this.configUpdated(config)

		try {
			this.updateActions() // export actions
			//this.updateVariableDefinitions() // export variable definitions
		} catch (err) {
			this.updateStatus(InstanceStatus.UnknownError, String(err))
			this.log('error', String(err))
		}
	}
	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		if (config.pollinterval == undefined || config.pollinterval == '') {
			config.pollinterval = 1
		}
		config.pollinterval = parseFloat(config.pollinterval)
		if (isNaN(config.pollinterval)) {
			this.updateStatus(InstanceStatus.BadConfig, 'Poll interval must be a number')
			return
		}
		this.config = config
		await this.connect()
	}

	async connect() {
		var settings = {
			host: this.config.host,
			port: this.config.port,
			user: this.config.user,
			database: this.config.database,
			waitForConnections: true,
		}
		if (this.config.password != '') {
			settings.password = this.config.password
		}
		try {
			this.pool = await mysql.createPool(settings)
			this.updateStatus(InstanceStatus.Ok)
			this.isInitialized = true
			await this.updateFeedbacks() // export feedbacks
		} catch (err) {
			this.updateStatus(InstanceStatus.ConnectionFailure, String(err))
			this.log('error', 'CONNECT' + String(err))
		}
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Database Host',
				width: 8,
				default: 'localhost',
			},
			{
				type: 'number',
				id: 'port',
				label: 'Port',
				width: 4,
				default: 3306,
				min: 1,
				max: 65535,
			},
			{
				type: 'textinput',
				id: 'user',
				label: 'Username',
				width: 6,
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 6,
			},
			{
				type: 'textinput',
				id: 'database',
				label: 'Database',
				width: 12,
			},
			{
				type: 'number',
				id: 'pollinterval',
				label: 'Poll Time (s)',
				width: 6,
				min: 0.1,
				step: 0.1,
				tooltip: 'Seconds between polls to update the variables via feedbacks.',
				default: 1,
			},
			{
				type: 'checkbox',
				id: 'reset_variables',
				label: 'Reset Variables',
				tooltip: 'Reset variables on init and on connect',
				width: 6,
				default: true,
			},
		]
	}

	updateVariables(callerId = null) {
		let variables = new Set()
		let defaultValues = {}
		this.requests.forEach((subscription, subscriptionId) => {
			if (!subscription.variableName.match(/^[a-zA-Z0-9_]+$/)) {
				return
			}
			variables.add(subscription.variableName)
			if (callerId === null || callerId === subscriptionId) {
				defaultValues[subscription.variableName] = ''
			}
		})
		let variableDefinitions = []
		variables.forEach((variable) => {
			variableDefinitions.push({
				name: variable,
				variableId: variable,
			})
		})
		this.setVariableDefinitions(variableDefinitions)
		if (this.config.reset_variables) {
			this.setVariableValues(defaultValues)
		}
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	/* request: Dictionary with these fields:
	 * sqlQuery      required     SQL query string
	 * params        optional     If params is set, the query needs to be prepared and params contains the variable fields
	 * variableName  optional     Name of the variable to assign the result to
	 * format        optional     In which format to store the result in the variable. Default: JSON
	 * value         optional     Old value of the variable. The variable will only be updated if the value changes
	 */
	async processDBRequest(request) {
		var query = null
		var params = []
		if (request.params == undefined) {
			query = await this.parseVariablesInString(request.sqlQuery)
		} else {
			for (var i = 0; i < request.params.length; i++) {
				params[i] = await this.parseVariablesInString(request.params[i])
			}
		}
		try {
			var results
			var fields
			if (query != null) {
				;[results, fields] = await this.pool.query({
					sql: query,
					rowsAsArray: request.format == 'array',
				})
			} else {
				;[results, fields] = await this.pool.execute({
					sql: request.sqlQuery,
					values: params,
					rowsAsArray: request.format == 'array',
				})
			}
			if (request.variableName != undefined) {
				var value
				switch (request.format ?? 'json') {
					case 'json':
						value = JSON.stringify(results)
						break
					case 'first':
						value = results[0][Object.keys(results[0])[0]]
						break
					case 'object':
					case 'array':
						value = results
						break
				}
				if (!areValuesEqual(request.value, value)) {
					request.value = value
					this.setVariableValues({ [request.variableName]: value })
				}
			}
			if (this.lastError != 0 && this.lastError + 3000 * this.config.pollinterval + 500 < Date.now()) {
				this.updateStatus(InstanceStatus.Ok)
				this.lastError = 0
			}
		} catch (err) {
			this.log('error', JSON.stringify(err))
			this.updateStatus(InstanceStatus.ConnectionFailure, JSON.stringify(err))
			this.lastError = Date.now()
		}
	}
}

function areValuesEqual(value1, value2) {
	const isEqual = (a, b) => {
		// If types are different, they can't be equal
		if (typeof a !== typeof b) return false

		// Check for strings
		if (typeof a === 'string' || typeof a === 'number') {
			return a === b
		}

		// Check for arrays
		if (Array.isArray(a) && Array.isArray(b)) {
			return a.length === b.length && a.every((element, index) => isEqual(element, b[index]))
		}

		if (typeof a === 'object') {
			// Check for objects
			if (a == null && b == null) {
				return true
			}

			if (a !== null && b !== null) {
				const aKeys = Object.keys(a)
				const bKeys = Object.keys(b)
				return aKeys.length === bKeys.length && aKeys.every((key) => b.hasOwnProperty(key) && isEqual(a[key], b[key]))
			}
		}

		// Fallback for other types
		return false
	}

	return isEqual(value1, value2)
}

runEntrypoint(ModuleInstance, UpgradeScripts)
