(function(w) {
    'use strict'



    var _extend,
        _bind,
        prevInit = false,
        BaseClass,
        Events,
        Modules,
        Module,
        Controller,
        ViewContainer,
        AgileClass,
        prevSingInit = false,
        AgileSingleton,
        BaseSingleton,
        RestEndpoints,
        restEndpoints,
        EndpointCommand,
        eventParser = /^(\S+)\s*(.*)$/,
        Agile = w.Agile = {
            version: '0.0.1'
        };


_extend = Agile.extend = function(obj) {
	var keys, ind, mixin, ln, i = 1, l = arguments.length;
	for(;i < l; i++) {
		mixin = arguments[i];
		keys = Object.keys(mixin);
		ln = keys.length;
		for (ind = 0; ind < ln; ind++) {
			obj[keys[ind]] = mixin[keys[ind]];
		}
	}

	return obj;
};

_bind = Agile.bind = function(fn, context) {
	if (Function.prototype.bind) {
		return fn.bind(context);
	}

	return function() {
		fn.apply(context, arguments);
	};
};

Agile.debounce = function (func, threshold, execAsap, context) {
	// debouncing function from John Hann
	//http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
	var timeout;

	return function debounced () {
		var obj = context || this, args = arguments;
		function delayed () {
			if (!execAsap)
				func.apply(obj, args);
			timeout = null;
		};

		if (timeout)
			clearTimeout(timeout);
		else if (execAsap)
			func.apply(obj, args);

		timeout = setTimeout(delayed, threshold || 100);
	};
};

Agile.callExternalUrl = function(options) {
	$.ajax(options);
};

    Events = Agile.Events = {

        triggerToModule: function(event, options) {
            this.trigger('module:' + event, options);
        },

        trigger: function (event, options) {
            var listeners = this._events && this._events[event], i, l;

            if (!listeners || listeners.length === 0) {
                return;
            }

            for (i = 0, l = listeners.length; i < l; i++) {
                listeners[i].callback.call(listeners[i].context, options, event);
            }
        },

        listenTo: function (obj, event, callback) {
            this._listenTo = this._listenTo || [];

            obj._events = obj._events || {};

            obj._events[event] = obj._events[event] || [];

            obj._events[event].push({
                listener: this,
                callback: callback,
                context: this
            });

            this._listenTo.push({
                obj: obj,
                event: event,
                callback: callback,
                context: this
            });
        },

        stopListenTo: function (obj, event, callback) {
            var keep = [], listener;

            event = event || 'all';
            callback = callback || 'all';

            for (var i = 0, l = this._listenTo.length; i < l; i++) {
                listener = this._listenTo[i];
                if ((event !== listener.event && event !== 'all') || (listener.callback !== callback && callback !== 'all')) {
                    keep.push(this._listenTo[i]);
                    continue;
                }

                listener.obj.removeListener(listener.event, listener.callback);
            }

            this._listenTo = keep;
        },

        stopListen: function () {
            var listener;
            
            if (!this._listenTo) {
                return;
            }

            for (var i = 0, l = this._listenTo.length; i < l; i++) {
                listener = this._listenTo[i];
                listener.obj.removeListener(listener.event, listener.callback, listener.context);
            }

            this._listenTo = [];

        },

        addListener: function (event, callback, context, listener) {

            this._events = this._events || {};

            this._events[event] = this._events[event] || [];

            this._events[event].push({
                callback: callback,
                context: context
            });
        },

        removeListener: function (event, callback, context) {
            var listeners, keep = [], l, i;

            callback = callback || 'all';

            if (!this._events || !this._events[event] || this._events[event].length === 0) {
                return;
            }

            listeners = this._events[event];

            for (i = 0, l = listeners.length; i < l; i++) {
                if ((listeners[i].callback === callback && (listeners[i].context === context || context === undefined)) || callback === 'all') {
                    continue;
                }

                keep.push(listeners[i]);
            }

            this._events[event] = keep;
        }
    };

Agile.Class = AgileClass = BaseClass = function() {};

AgileClass.extend = function() {
	var classProto, i;

	prevInit = true;
	classProto = new this();
	prevInit = false;

	function AgileClass() {
		if (prevInit === true) {
			return this;
		}

		if (this.__initConstructor) {
			this.__initConstructor.apply(this, arguments);
		} else {
			if (this.initialize) {
				this.initialize.apply(this, arguments);
			}
		}
	}

	for (i = 0; i < arguments.length; i++) {
		_extend(classProto, arguments[i]);
	}

	AgileClass.prototype = classProto;

	AgileClass.prototype.constructor = AgileClass;

	AgileClass.extend = BaseClass.extend;

	return AgileClass;
};

    Agile.Singleton = AgileSingleton = BaseSingleton = function() {};

    AgileSingleton.extend = function() {
        var classProto, i;

        prevSingInit = true;
        classProto = new this();
        prevSingInit = false;

        function AgileSingleton() {
            if (prevInit === true) {
                return this;
            }

            if (!this.constructor.__createInstance) {
                throw 'you must use getInstance method instead of instantiating this class';
            }

            this.options = arguments;

            if (this.__initConstructor) {
                this.__initConstructor.apply(this, arguments);
            } else {
                if (this.initialize) {
                    this.initialize.apply(this, arguments);
                }
            }
        }

        for (i = 0; i < arguments.length; i++) {
            _extend(classProto, arguments[i]);
        }

        AgileSingleton.prototype = classProto;

        AgileSingleton.prototype.constructor = AgileSingleton;

        AgileSingleton.extend = BaseSingleton.extend;

        AgileSingleton.getInstance = function() {
            if (!this.__instance) {
                this.__createInstance = true;
                this.__instance = new this();
                this.__createInstance = false;
            }

            return this.__instance;
        };

        return AgileSingleton;
    };

Agile.Application = Agile.Class.extend(Events, {

	__initConstructor: function() {
		this.modules = new Modules(this);

		this.vent = this.modules;

		this._bindApplicationEvents();
	},


	_bindApplicationEvents: function() {
		var i, keys, method, event;

		if (!this.appEvents) {
			return;
		}

		keys = Object.keys(this.appEvents);

		for (i = 0; i < keys.length; i++) {
			event = keys[i];
			method = this.appEvents[event];
			method = this[method];

			this.listenTo(this.vent, 'app:' + event, method);
		}
	},

});
    Agile.Command = Agile.Class.extend({

        initialize: function (controller) {
            this.controller = controller;
        },

        execute: function () {
            return this;
        },

        onSuccess: function () {
            return this;
        },

        onFailure: function () {
            return this;
        },

        onComplete: function () {
            return this;
        },

        trigger: function (event, options) {
            this.controller.trigger(event, options);
        },

        triggerToModule: function(event, options) {
            this.controller.triggerToModule(event, options);
        },

        triggerToApp: function(event, options) {
            this.controller.trigger('app:' + event, options);
        }
    });
    Controller = Agile.Controller = Agile.Class.extend(Agile.Events, {

        moduleEvents: {},

        commands: {},

        __initConstructor: function (module) {
            this.__module = module;

            this.vent = this.__module;

            this._bindCommands();

            this._bindModuleEvents();

            if (this.initialize) {
                this.initialize.apply(this, arguments);
            }
        },

        trigger: function (event, options) {
            if (event.indexOf('module:') === 0 || event.indexOf('app:') === 0) {
                return this.vent.trigger(event, options);
            }

            Events.trigger.call(this, event, options);
        },

        _bindCommands: function () {
            var keys, i, l, Command, command;

            if (!this.commands) {
                return;
            }

            this.__commands = this.commands;

            this.commands = {};

            this.endpoints = {};

            keys = Object.keys(this.moduleEvents);

            for (i = 0, l = keys.length; i < l; i++) {
                Command = this.__commands[this.moduleEvents[keys[i]]];

                command = new Command(this);

                if (command instanceof EndpointCommand) {
                    this.endpoints[keys[i]] = command;
                }
                
                this.commands[this.moduleEvents[keys[i]]] = command;
            }
        },

        _bindModuleEvents: function () {
            var i, keys = Object.keys(this.moduleEvents);

            for (i = 0; i < keys.length; i++) {
                this.listenTo(this.__module, 'module:' + keys[i], (function(index, context) {
                    return _bind(function (data) {
                        var commandName = this.moduleEvents[keys[index]],
                            command = this.commands[commandName];

                        command.execute(data);
                    }, context);
                })(i, this));
            }
        },

        close: function() {
            this.stopListen();
        }
    });
    EndpointCommand = Agile.EndpointCommand = Agile.Command.extend({

        _requestMethod: {
            'GET': 'onGet',
            'POST': 'onPost',
            'PUT': 'onPut',
            'DELETE': 'onDelete',
        },

        initialize: function (controller) {
            this.controller = controller;

            this.method = this.method || 'GET';

            this._buildAccessor();
        },

        _buildAccessor: function () {
            var i, methods = this.method || 'GET';

            if (typeof methods === 'string') {
                methods = [methods];
            }

            for (i = 0; i < methods.length; i++) {
                this[methods[i].toLowerCase()] = (function(index, context) {
                    return _bind(function (options, callback) {
                        var method;

                        options = options || {};
                        method = methods[index];
                        options.method = method;

                        return this.execute(options);
                    }, context);
                }) (i, this);
            }
        },

        execute: function (options) {
            var url, query, endpointOptions;

            endpointOptions = _extend({}, (options || {}));

            if (!endpointOptions.method && typeof this.method === 'string') {
                endpointOptions.method = this.method;
            }


            if (this.Accept) {
                endpointOptions.Accept = this.Accept;
            }

            if (this.preventCache) {
                endpointOptions.preventCache = this.preventCache;
            }

            if (this.dataType) {
                endpointOptions.dataType = this.dataType;
            }

            if (endpointOptions.method !== this.method && this.method.indexOf(endpointOptions.method) < 0) {
                throw 'This method is not allowed on this EndPoint';
            }

            url = this._resolveUrl(endpointOptions);

            if (this.query) {
                query = this.query(endpointOptions);
                url = url + this._resolveQueryParams(query);
            }

            var requestParams = {
                url : url,
                data: endpointOptions,
                method: endpointOptions.method,
                dataType: endpointOptions.dataType,
                preventCache: endpointOptions.preventCache,
                Accept: endpointOptions.Accept
            };

            if (this.body && endpointOptions.method !== 'GET') {
                requestParams.body = this.body(endpointOptions);
            }

            return this._callService(requestParams, options);
        },

        resetCache: function (request) {
            if (request) {
                return restEndpoints.clear(request);
            }

            restEndpoints.clear({
                type: 'pattern',
                url: this.url.replace(/:([^\/$]+)/g, '.*?'),
            });
        },

        _callService: function (requestParams, options) {
            var deferred = $.Deferred();

            deferred.done(_bind(function(data, status, xhr) {
                var methodName = this._requestMethod[requestParams.method],
                    method = this[methodName];

                if (method) {
                    method.call(this, requestParams);
                }

                this.onSuccess(data, options, status, xhr);
            }, this));

            deferred.fail(_bind(this.onFailure, this));

            deferred.always(_bind(this.onComplete), this);

            restEndpoints.call(requestParams, deferred);

            return deferred;
        },

        _resolveUrl: function (params) {
            return this.url.replace(/:([^\/$]+)/g, function (str, key) {
                return params[key];
            });
        },

        _resolveQueryParams: function (data) {
            return this._resolveParams(data, '?');
        },

        _resolveDataParams: function (data) {
            return this._resolveParams(data, '');
        },

        _resolveParams: function (data, prefix) {
            var i, keys = Object.keys(data), result = '';

            for (i = 0; i < keys.length; i++) {
                if (result === '') {
                    result = prefix + keys[i] + '=' + data[keys[i]];
                    continue;
                }
                result = result + '&' + keys[i] + '=' + data[keys[i]];
            }

            return result;
        }
    });

    Module = Agile.Module = Agile.Class.extend(Agile.Events, {
        __initConstructor: function(layoutOptions, moduleConnector) {

            this.moduleConnector = moduleConnector;

            this.vent = this.moduleConnector;

            if (!this.controller) {
                throw('Module needs a valid controller');
            }

            if (!this.layout) {
                throw('Module needs a valid view');
            }

            this.__initController();
            this.__initLayout(layoutOptions);
        },

        __initController: function() {
            var Controller;
            if (!this._controller) {
                Controller = this._controller = this.controller;
            }

            this.controller = new Controller(this);
        },

        __initLayout: function(options) {
            var Layout;

            options = options || {};

            if (!this._layout) {
                Layout = this._layout = this.layout;
            }

            _extend(options, {
                controller: this.controller
            });

            this.layout = new Layout(options);

            if (!options.placeHolder) {
                return;
            }

            this._container = options.placeHolder;

            if (typeof this._container === 'string') {
                this._container = new ViewContainer({
                    selector: options.placeHolder
                });
            }

            this._container.show(this.layout);
        },

        trigger: function(event, options) {
            if (event.indexOf('app:') === 0) {
                return this.vent.trigger(event, options);
            }

            Events.trigger.call(this, event, options);
        },

        close: function () {
            this.trigger('module::close');

            this.controller.close();
        }

    });
    Modules = Agile.Modules = Agile.Class.extend(Events, {
        __modules: {},

        __initConstructor: function(app) {
            this.__app = app;

            this.vent = this.__app;
        },

        register: function (moduleName, module) {
            if (typeof module === 'function') {
                return this.__modules[moduleName] = module;
            }

            this.__modules[moduleName] = Module.extend(module);
        },

        start: function (moduleName, layoutOptions) {
            var Module = this.__modules[moduleName];

            if (!Module) {
                throw(moduleName + ' does not exist');
            }

            return new Module(layoutOptions, this);
        },

        hasNot: function(moduleName) {
            var i, length, hasNot = [];

            if (typeof moduleName === 'string') {
                return !!this.__modules[moduleName]? hasNot: [moduleName];
            }


            for (i = 0, length = moduleName.length; i < length; i++) {
                if (!this.__modules[moduleName[i]]) {
                    hasNot.push(moduleName[i]);
                }
                
            }

            return hasNot;
        }
    });

    /*Object.defineProperty(Agile, 'modules', {
        get : function() {
            return Modules.getInstance();
        }
    });*/

    RestEndpoints = Agile.RestEndpoints = Agile.Singleton.extend({
        _endPoints: {},

        _cacheUrl: {},

        _pendingRequests: {},

        _queueRequests: {},

        _clearType: {
            STRING: 'string',
            PATTERN: 'pattern',
            ALL: 'ALL'
        },

        _requestState: {
            RESOLVE: 'resolve',
            REJECT: 'reject'
        },

        call: function (options, deferred) {
            var url = options.url;

            if (!url) {
                return;
            }

            options.method = options.method || 'GET';

            options.preventCache = options.preventCache || false;

            this._execRequest(options, deferred);
        },

        _clearPatternCache: function() {
            var i,
                keys,
                regExp,
                cache = this._cacheUrl;

            keys = Object.keys(cache);

            regExp = new RegExp(options.url, "g");

            for (i = 0; i < keys.length; i++) {
                if (regExp.exec(keys[i])) {
                    delete this._cacheUrl[keys[i]];
                }
            }
        },

        clear: function(options) {
            var type;

            if (!options || options.type === this._clearType.ALL) {
                this._cacheUrl = {};
            }

            type = options.type || this._clearType.STRING;

            if (type === this._clearType.PATTERN) {
                return this._clearPatternCache(options);
            }

            this._deleteObjectCalls(options, this._cacheUrl);
        },

        _registerEndPointResponse: function (options, data) {
            this._setObjectCalls(options, this._cacheUrl, data);
        },

        _getCacheResponse: function (options) {
            return this._getObjectCalls(options, this._cacheUrl);
        },

        _setPendingResquest: function(options) {
            this._setObjectCalls(options, this._pendingRequests, true);
        },

        _checkPendingRequest: function(options) {
            return !!this._getObjectCalls(options, this._pendingRequests);
        },

        _enqueueRequest: function(options, deferred) {
            var queueRequests = this._setObjectCalls(options, this._queueRequests, []);

            queueRequests.push(deferred);
        },

        _getObjectCalls: function(options, object) {
            var url = options.url;

            if (!object[url]) {
                return false;
            }

            return object[url];
        },

        _deleteObjectCalls: function(options, object) {
            var url = options.url;

            delete object[url];
        },

        _setObjectCalls: function(options, object, value) {
            var url = options.url

            if (!object[url]) {
                object[url] = value;
            }

            return object[url];
        },

        _resolveQueueRequests: function(state, options, data, status, xhr) {
            var i,
                method,
                object = this._getObjectCalls(options, this._queueRequests);

            if (!object) {
                return;
            }

            for (i = 0; i < object.length; i++) {
                method = object[i][state];
                method(data, status, xhr);
            }

            this._deleteObjectCalls(options, this._pendingRequests);
            this._deleteObjectCalls(options, this._queueRequests);
        },

        _execRequest: function (options, deferred) {
            var data = this._getCacheResponse(options);
            if (data !== false && !options.preventCache && options.method === 'GET') {
                return deferred.resolve(data);
            }

            if (options.method === 'GET') {
                return this._execGetAjaxRequest(options, deferred);
            }

            this._execAjaxRequest(options, function (data, status, xhr){
                deferred.resolve(data, status, xhr);
            }, function () {
                deferred.reject(data, status, xhr);
            });
        },

        _execGetAjaxRequest: function (options, deferred) {
            this._enqueueRequest(options, deferred);

            if (this._checkPendingRequest(options)) {
                return;
            }

            this._setPendingResquest(options);

            this._execAjaxRequest(options,
                _bind(function (data, status, xhr) {
                    if (!options.preventCache) {
                        this._registerEndPointResponse(options, data);
                    }

                    this._resolveQueueRequests(this._requestState.RESOLVE, options, data, status, xhr);
                }, this),
                _bind(function (xhr, status, data) {
                    this._resolveQueueRequests(this._requestState.REJECT, options, data, status, xhr);
            }, this));
        },

        _execAjaxRequest: function(options, success, fail) {
            var baseOptions = {
                url: options.url,
                method: options.method,
                data: options.body
            };

            if (options.dataType) {
                baseOptions.dataType = options.dataType;
            }

            if (options.Accept) {
                baseOptions.Accept = options.Accept;
            }

            $.ajax(baseOptions).done(success).fail(fail);
        }
    });

    Object.defineProperty(Agile, 'restEndpoints', {
        get : function() {
            return RestEndpoints.getInstance();
        }
    });

	Agile.View = Agile.Class.extend(Events, {
		template: null,
		
		bindedTo: null,
		
		tagName: 'div',
		
		__initConstructor: function(options) {

			this.options = options;

			if (options && options.controller && options.controller instanceof Controller) {
				this.controller = options.controller;
			}

			this._bindModuleEvents();

			if (this.initialize) {
				this.initialize.apply(this, arguments);
			}

			this._getTagElement();
			
			this._renderUI();
		},

		render: function() {
			return this;
		},

		onShow: function() {
			return this;
		},
		
		onRender: function() {
			return this;
		},
		
		onBinding: function() {
			return this;
		},
		
		getTemplate: function() {
			return this.template;
		},
		
		getTemplateData: function() {
			return this;
		},
		
		_createTagElement: function() {
			this.el = document.createElement(this.tagName);
			if (this.className) {
				this.el.className = this.className;
			}

			this.$el = $(this.el);

		},
		
		_getTagElement: function() {
			if (this.bindedTo) {
				this.$el = $(this.bindedTo);
				
				if (this.$el.length) {
					this._isBinded = true;

					if (this.className) {
						this.$el.addClass(this.className);
					}

					return this.$el;
				}
				
				console.warn(this.bindedTo, 'does not exist');

				return;
			}
			
			return this._createTagElement();
		},
		
		_renderUI: function() {
			this.render(this.getTemplateData(), this.getTemplate());
			this._bindUI();
			this._bindEvents();
			this._bindViewContainers();
			this._onBinding();
			this._onRender();
		},

		_onBinding: function() {
			if (this._isBinded) {
				return this.onBinding();
			}
		},
		
		_onRender: function() {
			this.onRender();
		},
		
		_bindUI: function() {
			var p;
			
			if (!this.ui || !this.$el) {
				return;
			}
			
			if (!this._uiBindings) {
		      this._uiBindings = this.ui;
		    }

		    this.ui = {};
			
			for(p in this._uiBindings) {
				this.ui[p] = this.$el.find(this._uiBindings[p]);
			}
			
		},

		createView: function (View, args) {
			args = args || {};

			if (this.controller) {
				args = _extend({}, args, {
					controller: this.controller
				});
			} else {
				args = _extend({}, args);
			}

			return new View(args);
		},

		trigger: function(event, options) {
			if (event.indexOf('module:') === 0) {
				return this.controller.vent.trigger(event, options);
			}

			Events.trigger.call(this, event, options);
		},

		_bindViewContainers: function() {
			var i, keys;

			if (!this.viewContainers) {
				return;
			}

			keys = Object.keys(this.viewContainers);

			for (i = 0; i < keys.length; i++) {
				this[keys[i]] = new ViewContainer({
					selector: this.viewContainers[keys[i]],
					container: this.$el
				});
			}
		},

		_bindModuleEvents: function() {
			var i, keys, method, event;

			if (!this.controller) {
				return;
			}

			this.listenTo(this.controller.vent, 'module::close', this.close);

			if (!this.moduleEvents) {
				return;
			}

			keys = Object.keys(this.moduleEvents);

			for (i = 0; i < keys.length; i++) {
				event = keys[i];
				method = this.moduleEvents[event];
				method = this[method];

				this.listenTo(this.controller.vent, 'module:' + event, method);
			}
		},
		
		_bindEvents: function() {
			var keys, i, event, method, selector;
			
			if (!this.events || !this.$el) {
				return;
			}
			
			keys = Object.keys(this.events);
			for(i = 0; i < keys.length; i++) {
				method = this.events[keys[i]];
				
				if (typeof this[method] !== 'function') {
					continue;
				}
				
				method = this[method];
				
				event = keys[i].match(eventParser);
				
				selector = event[2];
				
				event = event[1];
				
				this.$el.on(event + '.delegateEvents', selector, _bind(method, this));
				
			}
		},
		
		close: function() {
			var p;

			for(p in this.ui) {
				delete this.ui[p];
			}
			
			this.ui = this._uiBindings;
			
			this.$el.off('.delegateEvents');

			this.stopListen();

			this.onClose();
		},

		onClose: function() {
			return this;
		}
	});
ViewContainer = Agile.ViewContainer = Agile.Class.extend({

    initialize: function (options) {
        if (typeof options === 'string') {
            options = {
                selector: options
            }
        }

        this._selector = options.selector;
        this._container = options.container;
        this._isBinded = false;

        this._bindElements();
    },


    _bindElements: function () {
        if (!this._container) {
            return this.$el = $(this._selector);
        }

        if (!(this._container instanceof jQuery)) {
            this._container = $(this._container);
        }

        this.$el = $(this._container).find(this._selector);

        if (this.$el.length) {
            this._isBinded = true;
        }
    },


    show: function (view) {
        if (this._view) {
            this.close();
        }

        this._view = view;

        this.$el.append(view.$el);

        if (this._view.onShow) {
            this._view.onShow();
        }
    },

    close: function (){
        if (this._view) {
            this._view.close();
        }

        this.$el.html('');

        this._view = null;
    }
});

    Agile.Widget = Agile.View.extend({
        __initConstructor: function (options) {

            if (options && options.controller && options.controller instanceof Controller) {
                this.controller = options.controller;
            }

            this._bindModuleEvents();

            if (this.initialize) {
                this.initialize.apply(this, arguments);
            }

            this._getTagElement();

            if (this.templateUrl) {
                return this.getExternalTemplate(this._renderUI);
            }

            this._renderUI();
        },

        getExternalTemplate: function (callback) {
            $.ajax({
                url: this.templateUrl,
                method: 'GET',
                dataType: 'html',
                crossDomain: true,
                success: _bind(function (data) {
                    this.template = data;
                    callback.apply(this);
                }, this)
            });
        },

        render: function (data, template) {
            this.$el.html(template);
        }
    });
	
	restEndpoints = Agile.restEndpoints;

	return Agile;

})(window);






