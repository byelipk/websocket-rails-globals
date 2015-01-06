/*
  WebsocketRails JavaScript Client

  Setting up the dispatcher:
  var dispatcher = new WebSocketRails('localhost:3000/websocket');
  dispatcher.on_open = function() {
    // trigger a server event immediately after opening connection
    dispatcher.trigger('new_user',{user_name: 'guest'});
  })

  Triggering a new event on the server
  dispatcherer.trigger('event_name',object_to_be_serialized_to_json);

  //Listening for new events from the server
  dispatcher.bind('event_name', function(data) {
    console.log(data.user_name);
  });

  Stop listening for new events from the server
  dispatcher.unbind('event')
*/
var __bind = function(fn, me) {
  return function() {
    return fn.apply(me, arguments);
  };
};

this.WebSocketRails = (function() {
  function WebSocketRails(url, use_websockets) {
    this.url = url;
    this.use_websockets = use_websockets != null ? use_websockets : true;
    this.connection_stale = __bind(this.connection_stale, this);
    this.supports_websockets = __bind(this.supports_websockets, this);
    this.dispatch_channel = __bind(this.dispatch_channel, this);
    this.unsubscribe = __bind(this.unsubscribe, this);
    this.subscribe_private = __bind(this.subscribe_private, this);
    this.subscribe = __bind(this.subscribe, this);
    this.dispatch = __bind(this.dispatch, this);
    this.trigger_event = __bind(this.trigger_event, this);
    this.trigger = __bind(this.trigger, this);
    this.bind = __bind(this.bind, this);
    this.connection_established = __bind(this.connection_established, this);
    this.new_message = __bind(this.new_message, this);
    this.reconnect = __bind(this.reconnect, this);
    this.callbacks = {};
    this.channels = {};
    this.queue = {};
    this.connect();
  }
  WebSocketRails.prototype.connect = function() {
    this.state = 'connecting';
    if (!(this.supports_websockets() && this.use_websockets)) {
      this._conn = new WebSocketRails.HttpConnection(this.url, this);
    } else {
      this._conn = new WebSocketRails.WebSocketConnection(this.url, this);
    }
    return this._conn.new_message = this.new_message;
  };
  WebSocketRails.prototype.disconnect = function() {
    if (this._conn) {
      this._conn.close();
      delete this._conn._conn;
      delete this._conn;
    }
    return this.state = 'disconnected';
  };
  WebSocketRails.prototype.reconnect = function() {
    var event, id, old_connection_id, _ref, _ref2;
    old_connection_id = (_ref = this._conn) != null ? _ref.connection_id : void 0;
    this.disconnect();
    this.connect();
    _ref2 = this.queue;
    for (id in _ref2) {
      event = _ref2[id];
      if (event.connection_id === old_connection_id && !event.is_result()) {
        this.trigger_event(event);
      }
    }
    return this.reconnect_channels();
  };
  WebSocketRails.prototype.new_message = function(data) {
    var event, _ref;
    event = new WebSocketRails.Event(data);
    if (event.is_result()) {
      if ((_ref = this.queue[event.id]) != null) {
        _ref.run_callbacks(event.success, event.data);
      }
      this.queue[event.id] = null;
    } else if (event.is_channel()) {
      this.dispatch_channel(event);
    } else {
      this.dispatch(event);
    }
    if (this.state === 'connecting' && event.name === 'client_connected') {
      return this.connection_established(event);
    }
  };
  WebSocketRails.prototype.connection_established = function(event) {
    this.state = 'connected';
    this._conn.setConnectionId(event.connection_id);
    this._conn.flush_queue();
    if (this.on_open != null) {
      return this.on_open(event.data);
    }
  };
  WebSocketRails.prototype.bind = function(event_name, callback) {
    var _base, _ref;
    if ((_ref = (_base = this.callbacks)[event_name]) == null) {
      _base[event_name] = [];
    }
    return this.callbacks[event_name].push(callback);
  };
  WebSocketRails.prototype.trigger = function(event_name, data, success_callback, failure_callback) {
    var event;
    event = new WebSocketRails.Event([
      event_name, data, {
        connection_id: this.connection_id
      }
      ], success_callback, failure_callback);
      this.queue[event.id] = event;
      return this._conn.trigger(event);
    };
    WebSocketRails.prototype.trigger_event = function(event) {
      var _base, _name, _ref;
      if ((_ref = (_base = this.queue)[_name = event.id]) == null) {
        _base[_name] = event;
      }
      this._conn.trigger(event);
      return event;
    };
    WebSocketRails.prototype.dispatch = function(event) {
      var callback, _i, _len, _ref, _results;
      if (this.callbacks[event.name] == null) {
        return;
      }
      _ref = this.callbacks[event.name];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        callback = _ref[_i];
        _results.push(callback(event.data));
      }
      return _results;
    };
    WebSocketRails.prototype.subscribe = function(channel_name, success_callback, failure_callback) {
      var channel;
      if (this.channels[channel_name] == null) {
        channel = new WebSocketRails.Channel(channel_name, this, false, success_callback, failure_callback);
        this.channels[channel_name] = channel;
        return channel;
      } else {
        return this.channels[channel_name];
      }
    };
    WebSocketRails.prototype.subscribe_private = function(channel_name, success_callback, failure_callback) {
      var channel;
      if (this.channels[channel_name] == null) {
        channel = new WebSocketRails.Channel(channel_name, this, true, success_callback, failure_callback);
        this.channels[channel_name] = channel;
        return channel;
      } else {
        return this.channels[channel_name];
      }
    };
    WebSocketRails.prototype.unsubscribe = function(channel_name) {
      if (this.channels[channel_name] == null) {
        return;
      }
      this.channels[channel_name].destroy();
      return delete this.channels[channel_name];
    };
    WebSocketRails.prototype.dispatch_channel = function(event) {
      if (this.channels[event.channel] == null) {
        return;
      }
      return this.channels[event.channel].dispatch(event.name, event.data);
    };
    WebSocketRails.prototype.supports_websockets = function() {
      return typeof WebSocket === "function" || typeof WebSocket === "object";
    };
    WebSocketRails.prototype.connection_stale = function() {
      return this.state !== 'connected';
    };
    WebSocketRails.prototype.reconnect_channels = function() {
      var callbacks, channel, name, _ref, _results;
      _ref = this.channels;
      _results = [];
      for (name in _ref) {
        channel = _ref[name];
        callbacks = channel._callbacks;
        channel.destroy();
        delete this.channels[name];
        channel = channel.is_private ? this.subscribe_private(name) : this.subscribe(name);
        channel._callbacks = callbacks;
        _results.push(channel);
      }
      return _results;
    };
    return WebSocketRails;
})();


/*
  The Event object stores all the relevant event information.
*/
WebSocketRails.Event = (function() {
  function Event(message, success_callback, failure_callback) {
    var options;
    this.success_callback = success_callback;
    this.failure_callback = failure_callback;
    this.name = message[0];
    this.data = message[1];
    options = message[2];
    if (options != null) {
      this.id = options['id'] != null ? options['id'] : ((1 + Math.random()) * 0x10000) | 0;
      this.channel = options.channel;
      this.token = options.token;
      this.connection_id = options.connection_id;
      if (options.success != null) {
        this.result = true;
        this.success = options.success;
      }
    }
  }
  Event.prototype.is_channel = function() {
    return this.channel != null;
  };
  Event.prototype.is_result = function() {
    return typeof this.result !== 'undefined';
  };
  Event.prototype.is_ping = function() {
    return this.name === 'websocket_rails.ping';
  };
  Event.prototype.serialize = function() {
    return JSON.stringify([this.name, this.data, this.meta_data()]);
  };
  Event.prototype.meta_data = function() {
    return {
      id: this.id,
      connection_id: this.connection_id,
      channel: this.channel,
      token: this.token
    };
  };
  Event.prototype.run_callbacks = function(success, result) {
    this.success = success;
    this.result = result;
    if (this.success === true) {
      return typeof this.success_callback === "function" ? this.success_callback(this.result) : void 0;
    } else {
      return typeof this.failure_callback === "function" ? this.failure_callback(this.result) : void 0;
    }
  };
  return Event;
})();


/*
  Abstract Interface for the WebSocketRails client.
*/
WebSocketRails.AbstractConnection = (function() {
  function AbstractConnection(url, dispatcher) {
    this.dispatcher = dispatcher;
    this.message_queue = [];
  }
  AbstractConnection.prototype.close = function() {};
  AbstractConnection.prototype.trigger = function(event) {
    if (this.dispatcher.state !== 'connected') {
      return this.message_queue.push(event);
    } else {
      return this.send_event(event);
    }
  };
  AbstractConnection.prototype.send_event = function(event) {
    if (this.connection_id != null) {
      return event.connection_id = this.connection_id;
    }
  };
  AbstractConnection.prototype.on_close = function(event) {
    var close_event;
    if (this.dispatcher && this.dispatcher._conn === this) {
      close_event = new WebSocketRails.Event(['connection_closed', event]);
      this.dispatcher.state = 'disconnected';
      return this.dispatcher.dispatch(close_event);
    }
  };
  AbstractConnection.prototype.on_error = function(event) {
    var error_event;
    if (this.dispatcher && this.dispatcher._conn === this) {
      error_event = new WebSocketRails.Event(['connection_error', event]);
      this.dispatcher.state = 'disconnected';
      return this.dispatcher.dispatch(error_event);
    }
  };
  AbstractConnection.prototype.on_message = function(event_data) {
    if (this.dispatcher && this.dispatcher._conn === this) {
      return this.dispatcher.new_message(event_data);
    }
  };
  AbstractConnection.prototype.setConnectionId = function(connection_id) {
    this.connection_id = connection_id;
  };
  AbstractConnection.prototype.flush_queue = function() {
    var event, _i, _len, _ref;
    _ref = this.message_queue;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      event = _ref[_i];
      this.trigger(event);
    }
    return this.message_queue = [];
  };
  return AbstractConnection;
})();


/*
  HTTP Interface for the WebSocketRails client.
*/
var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
  for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me) {
    return function(){
      return fn.apply(me, arguments);
    };
  };
WebSocketRails.HttpConnection = (function() {
    __extends(HttpConnection, WebSocketRails.AbstractConnection);
    HttpConnection.prototype.connection_type = 'http';
    HttpConnection.prototype._httpFactories = function() {
      return [
      function() {
        return new XMLHttpRequest();
      }, function() {
        return new ActiveXObject("Msxml2.XMLHTTP");
      }, function() {
        return new ActiveXObject("Msxml3.XMLHTTP");
      }, function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      }
      ];
    };
    function HttpConnection(url, dispatcher) {
      this.dispatcher = dispatcher;
      HttpConnection.__super__.constructor.apply(this, arguments);
      this._url = "http://" + url;
      this._conn = this._createXMLHttpObject();
      this.last_pos = 0;
      this._conn.onreadystatechange = __bind(function() {
        return this._parse_stream();
      }, this);
      this._conn.addEventListener("load", this.on_close, false);
      this._conn.open("GET", this._url, true);
      this._conn.send();
    }
    HttpConnection.prototype.close = function() {
      return this._conn.abort();
    };
    HttpConnection.prototype.send_event = function(event) {
      HttpConnection.__super__.send_event.apply(this, arguments);
      return this._post_data(event.serialize());
    };
    HttpConnection.prototype._post_data = function(payload) {
      return $.ajax(this._url, {
        type: 'POST',
        data: {
          client_id: this.connection_id,
          data: payload
        },
        success: function() {}
      });
    };
    HttpConnection.prototype._createXMLHttpObject = function() {
      var factories, factory, xmlhttp, _i, _len;
      xmlhttp = false;
      factories = this._httpFactories();
      for (_i = 0, _len = factories.length; _i < _len; _i++) {
        factory = factories[_i];
        try {
          xmlhttp = factory();
        } catch (e) {
          continue;
        }
        break;
      }
      return xmlhttp;
    };
    HttpConnection.prototype._parse_stream = function() {
      var data, event_data;
      if (this._conn.readyState === 3) {
        data = this._conn.responseText.substring(this.last_pos);
        this.last_pos = this._conn.responseText.length;
        data = data.replace(/\]\]\[\[/g, "],[");
        event_data = JSON.parse(data);
        return this.on_message(event_data);
      }
    };
    return HttpConnection;
})();

/*
  WebSocket Interface for the WebSocketRails client.
*/
var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
  for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  WebSocketRails.WebSocketConnection = (function() {
    __extends(WebSocketConnection, WebSocketRails.AbstractConnection);
    WebSocketConnection.prototype.connection_type = 'websocket';
    function WebSocketConnection(url, dispatcher) {
      this.url = url;
      this.dispatcher = dispatcher;
      WebSocketConnection.__super__.constructor.apply(this, arguments);
      if (this.url.match(/^wss?:\/\//)) {
        console.log("WARNING: Using connection urls with protocol specified is depricated");
      } else if (window.location.protocol === 'https:') {
        this.url = "wss://" + this.url;
      } else {
        this.url = "ws://" + this.url;
      }
      this._conn = new WebSocket(this.url);
      this._conn.onmessage = __bind(function(event) {
        var event_data;
        event_data = JSON.parse(event.data);
        return this.on_message(event_data);
      }, this);
      this._conn.onclose = __bind(function(event) {
        return this.on_close(event);
      }, this);
      this._conn.onerror = __bind(function(event) {
        return this.on_error(event);
      }, this);
    }
    WebSocketConnection.prototype.close = function() {
      return this._conn.close();
    };
    WebSocketConnection.prototype.send_event = function(event) {
      WebSocketConnection.__super__.send_event.apply(this, arguments);
      return this._conn.send(event.serialize());
    };
    return WebSocketConnection;
})();


/*
The channel object is returned when you subscribe to a channel.
For instance:
var dispatcher = new WebSocketRails('localhost:3000/websocket');
var awesome_channel = dispatcher.subscribe('awesome_channel');
awesome_channel.bind('event', function(data) { console.log('channel event!'); });
awesome_channel.trigger('awesome_event', awesome_object);
*/
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
WebSocketRails.Channel = (function() {
  function Channel(name, _dispatcher, is_private, on_success, on_failure) {
    var event, event_name, _ref;
    this.name = name;
    this._dispatcher = _dispatcher;
    this.is_private = is_private;
    this.on_success = on_success;
    this.on_failure = on_failure;
    this._failure_launcher = __bind(this._failure_launcher, this);
    this._success_launcher = __bind(this._success_launcher, this);
    if (this.is_private) {
      event_name = 'websocket_rails.subscribe_private';
    } else {
      event_name = 'websocket_rails.subscribe';
    }
    this.connection_id = (_ref = this._dispatcher._conn) != null ? _ref.connection_id : void 0;
    event = new WebSocketRails.Event([
      event_name, {
        channel: this.name
      }, {
        connection_id: this.connection_id
      }
      ], this._success_launcher, this._failure_launcher);
      this._dispatcher.trigger_event(event);
      this._callbacks = {};
      this._token = void 0;
      this._queue = [];
    }
    Channel.prototype.is_public = function() {
      return !this.is_private;
    };
    Channel.prototype.destroy = function() {
      var event, event_name, _ref;
      if (this.connection_id === ((_ref = this._dispatcher._conn) != null ? _ref.connection_id : void 0)) {
        event_name = 'websocket_rails.unsubscribe';
        event = new WebSocketRails.Event([
          event_name, {
            channel: this.name
          }, {
            connection_id: this.connection_id,
            token: this._token
          }
          ]);
          this._dispatcher.trigger_event(event);
        }
        return this._callbacks = {};
      };
      Channel.prototype.bind = function(event_name, callback) {
        var _base, _ref;
        if ((_ref = (_base = this._callbacks)[event_name]) == null) {
          _base[event_name] = [];
        }
        return this._callbacks[event_name].push(callback);
      };
      Channel.prototype.unbind = function(event_name) {
        return delete this._callbacks[event_name];
      };
      Channel.prototype.trigger = function(event_name, message) {
        var event;
        event = new WebSocketRails.Event([
          event_name, message, {
            connection_id: this.connection_id,
            channel: this.name,
            token: this._token
          }
          ]);
          if (!this._token) {
            return this._queue.push(event);
          } else {
            return this._dispatcher.trigger_event(event);
          }
        };
        Channel.prototype.dispatch = function(event_name, message) {
          var callback, event, _i, _j, _len, _len2, _ref, _ref2, _results;
          if (event_name === 'websocket_rails.channel_token') {
            this._token = message['token'];
            _ref = this._queue;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              event = _ref[_i];
              this._dispatcher.trigger_event(event);
            }
            return this._queue = [];
          } else {
            if (this._callbacks[event_name] == null) {
              return;
            }
            _ref2 = this._callbacks[event_name];
            _results = [];
            for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
              callback = _ref2[_j];
              _results.push(callback(message));
            }
            return _results;
          }
        };
        Channel.prototype._success_launcher = function(data) {
          if (this.on_success != null) {
            return this.on_success(data);
          }
        };
        Channel.prototype._failure_launcher = function(data) {
          if (this.on_failure != null) {
            return this.on_failure(data);
          }
        };
        return Channel;
      })();
      
