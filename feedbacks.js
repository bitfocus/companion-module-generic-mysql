const { combineRgb, InstanceStatus } = require('@companion-module/base')

module.exports = async function (self) {
	self.setFeedbackDefinitions({
		SQLQuery: {
			type: 'advanced',
			name: 'Update variable via SQL query',
			description: 'Execute an SQL query and use its result to set the value of a variable.',
			options: [
				{
					type: 'textinput',
					label: 'SQL query',
					id: 'query',
					useVariables: true,
				},
				{
					type: 'textinput',
					label: 'Variable',
					id: 'variable',
					regex: '/^[a-zA-Z0-9_]+$/',
					default: '',
				},
				{
					type: 'dropdown',
					label: 'How to store the result in the variable',
					id: 'format',
					default: self.FORMATS[1].id,
					choices: self.FORMATS,
				},
			],
			callback: () => {
				// Nothing to do, as this feeds a variable
				return {}
			},
			subscribe: (feedback) => {
				self.requests.set(feedback.id, {
					variableName: feedback.options.variable,
					sqlQuery: feedback.options.query,
					value: null,
					format: feedback.options.format,
					poll: true,
				})
				if (self.isInitialized) {
					self.updateVariables(feedback.id)
				}
			},
			unsubscribe: (feedback) => {
				self.requests.delete(feedback.id)
			},
		},
	})

	if (self.pollInterval != undefined) {
		clearInterval(self.pollInterval)
	}
	self.pollInterval = setInterval(async () => {
		self.requests.forEach(async (subscription) => {
			if (subscription.poll) {
				await self.processDBRequest(subscription)
			}
			/*			var query = await self.parseVariablesInString(subscription.sqlQuery)
			try {
				const [results, fields] = await self.pool.query(query)
				if (results[0] != undefined) {
					var value = results[0][Object.keys(results[0])[0]]
					if (subscription.value != value) {
						subscription.value = value
						self.setVariableValues({ [subscription.variableName]: value })
					}
				}
				if (self.lastError != 0 && self.lastError + 2 * self.config.pollinterval + 500 < Date.now()) {
					self.updateStatus(InstanceStatus.Ok)
					self.lastError = 0
				}
			} catch (err) {
				self.log('error', JSON.stringify(err))
				self.updateStatus(InstanceStatus.ConnectionFailure, JSON.stringify(err))
				self.lastError = Date.now()
			} */
		})
	}, self.config.pollinterval * 1000)
}
