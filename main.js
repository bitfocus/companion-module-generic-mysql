const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')

const mysql = require('mysql2/promise');

class ModuleInstance extends InstanceBase {
	isInitialized = false
	subscriptions = new Map()
	lastError = 0 // timestamp of last sql error

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
			this.log("error", String(err))
		}
	}
	// When module gets deleted
	async destroy() {
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		if (config.pollinterval == undefined || config.pollinterval == '') {
			config.pollinterval = 1000
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
		if (this.config.password != "") {
		    settings.password = this.config.password
		}
		try {
		    this.pool = await mysql.createPool(settings)
		    this.updateStatus(InstanceStatus.Ok)
		    this.isInitialized = true
		    await this.updateFeedbacks() // export feedbacks
		} catch (err) {
		    this.updateStatus(InstanceStatus.ConnectionFailure, String(err))
		    this.log("error", String(err))
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
				label: 'Poll Time (ms)',
				width: 6,
				min: 100,
				tooltip: 'Time between polls to update the variables via feedbacks. In milliseconds.',
				default: 1000,
			},
			{
				type: 'checkbox',
				id: 'reset_variables',
				label: 'Reset Variables',
				tooltip: 'Reset variables on init and on connect',
				width: 6,
				default: true,
			}
		]
	}

	updateVariables(callerId = null) {
		let variables = new Set()
		let defaultValues = {}
		this.subscriptions.forEach((subscription, subscriptionId) => {
			if (!subscription.variableName.match(/^[a-zA-Z0-9_]/)) {
				return
			}
			variables.add(subscription.variableName)
			if (callerId === null || callerId ===subscriptionId) {
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
}

runEntrypoint(ModuleInstance, UpgradeScripts)
