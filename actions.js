module.exports = function (self) {
	self.setActionDefinitions({
		query: {
			name: 'Execute SQL Statement',
			options: [
				{
					id: 'dummy',
					type: 'static-text',
					label: 'Please note:',
					value: 'Variables are not escaped. You need to quote strings where needed.',
				},
				{
					id: 'query',
					type: 'textinput',
					label: 'SQL Query',
					useVariables: true,
				},
			],
			callback: async (event) => {
				var query = await self.parseVariablesInString(event.options.query)
				try {
					const [results, fields] = await self.pool.query(query)
				} catch (err) {
					self.log("error", String(err))
				}
			},
		},
		prepSQL: {
			name: 'Execute Prepared SQL Statement',
			options: [
				{
					id: 'dummy',
					type: 'static-text',
					label: 'Please note:',
					value: 'Use a question mark wherever you want to use a variable. Do not use quotes around strings. They will be added automatically. Example: INSERT INTO test (name) VALUES (?)',
				},
				{
					id: 'query',
					type: 'textinput',
					label: 'SQL Query',
					useVariables: false,
				},
				{
					id: 'var1',
					type: 'textinput',
					label: 'Parameter 1',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 1 : false
					}

				},
				{
					id: 'var2',
					type: 'textinput',
					label: 'Parameter 2',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 2 : false
					}
				},
				{
					id: 'var3',
					type: 'textinput',
					label: 'Parameter 3',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 3 : false
					}
				},
				{
					id: 'var4',
					type: 'textinput',
					label: 'Parameter 4',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 4 : false
					}
				},
				{
					id: 'var5',
					type: 'textinput',
					label: 'Parameter 5',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 5 : false
					}
				},
				{
					id: 'var6',
					type: 'textinput',
					label: 'Parameter 6',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 6 : false
					}
				},
				{
					id: 'var7',
					type: 'textinput',
					label: 'Parameter 7',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 7 : false
					}
				},
				{
					id: 'var8',
					type: 'textinput',
					label: 'Parameter 8',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 8 : false
					}
				},
				{
					id: 'var9',
					type: 'textinput',
					label: 'Parameter 9',
					useVariables: true,
					isVisible: (options) => { 
						const matches = options.query.match(/\?/g);
						return matches ? matches.length >= 9 : false
					}
				},
			],
			callback: async (event) => {
				const matches = event.options.query.match(/\?/g)
				const parameterCount =  matches ? matches.length : 0
				var params = []
				for (var i=1; i<= parameterCount; i++) {
					const p = await self.parseVariablesInString(event.options["var"+i])
					params.push(p)
				}

				try {
					const [results, fields] = await self.pool.execute(event.options.query, params)
				} catch (err) {
					self.log("error", String(err))
				}
			},
		}

	})
}
