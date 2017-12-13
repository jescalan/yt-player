import EventEmitter from 'events';

var loadScript2 = load;

function load (src, cb) {
  var head = document.head || document.getElementsByTagName('head')[0];
  var script = document.createElement('script');

  script.type = 'text/javascript';
  script.async = true;
  script.src = src;

  if (cb) {
    script.onload = function () {
      script.onerror = script.onload = null;
      cb(null, script);
    };
    script.onerror = function () {
      script.onerror = script.onload = null;
      cb(new Error('Failed to load ' + src), script);
    };
  }

  head.appendChild(script);
}

var YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
var YOUTUBE_STATES = {
    '-1': 'unstarted',
    '0': 'ended',
    '1': 'playing',
    '2': 'paused',
    '3': 'buffering',
    '5': 'cued'
};
var YOUTUBE_ERROR = {
    INVALID_PARAM: 2,
    HTML5_ERROR: 5,
    NOT_FOUND: 100,
    UNPLAYABLE_1: 101,
    UNPLAYABLE_2: 150
};
var loadIframeAPICallbacks = [];
var YouTubePlayer = (function (EventEmitter$$1) {
    function YouTubePlayer(element, opts) {
        var this$1 = this;

        EventEmitter$$1.call(this);
        var elem = typeof element === 'string' ? document.querySelector(element) : element;
        if (elem.id) {
            this._id = elem.id;
        } else {
            this._id = (elem.id = 'ytplayer-' + Math.random().toString(16).slice(2, 8));
        }
        this._opts = Object.assign({
            width: 640,
            height: 360,
            autoplay: false,
            captions: undefined,
            controls: true,
            keyboard: true,
            fullscreen: true,
            annotations: true,
            modestBranding: false,
            related: true,
            info: true,
            timeupdateFrequency: 1000
        }, opts);
        this.videoId = null;
        this.destroyed = false;
        this._api = null;
        this._player = null;
        this._ready = false;
        this._queue = [];
        this._interval = null;
        this._startInterval = this._startInterval.bind(this);
        this._stopInterval = this._stopInterval.bind(this);
        this.on('unstarted', this._stopInterval);
        this.on('ended', this._stopInterval);
        this.on('playing', this._startInterval);
        this.on('paused', this._stopInterval);
        this.on('buffering', this._stopInterval);
        this._loadIframeAPI(function (err, api) {
            if (err) 
                { return this$1._destroy(new Error('YouTube Iframe API failed to load')); }
            this$1._api = api;
            if (this$1.videoId) 
                { this$1.load(this$1.videoId); }
        });
    }

    if ( EventEmitter$$1 ) YouTubePlayer.__proto__ = EventEmitter$$1;
    YouTubePlayer.prototype = Object.create( EventEmitter$$1 && EventEmitter$$1.prototype );
    YouTubePlayer.prototype.constructor = YouTubePlayer;
    YouTubePlayer.prototype.load = function load (videoId, autoplay) {
        if (this.destroyed) 
            { return; }
        if (autoplay == null) 
            { autoplay = true; }
        this.videoId = videoId;
        if (!this._api) 
            { return; }
        if (!this._player) {
            this._createPlayer(videoId);
            this.emit('unstarted');
            this.emit('buffering');
            return;
        }
        if (!this._ready) 
            { return; }
        if (autoplay) {
            this._player.loadVideoById(videoId);
        } else {
            this._player.cueVideoById(videoId);
        }
    };
    YouTubePlayer.prototype.play = function play () {
        if (this._ready) 
            { this._player.playVideo(); }
         else 
            { this._queueCommand('play'); }
    };
    YouTubePlayer.prototype.pause = function pause () {
        if (this._ready) 
            { this._player.pauseVideo(); }
         else 
            { this._queueCommand('pause'); }
    };
    YouTubePlayer.prototype.stop = function stop () {
        if (this._ready) 
            { this._player.stopVideo(); }
         else 
            { this._queueCommand('stop'); }
    };
    YouTubePlayer.prototype.seek = function seek (seconds) {
        if (this._ready) 
            { this._player.seekTo(seconds, true); }
         else 
            { this._queueCommand('seek', seconds); }
    };
    YouTubePlayer.prototype.setVolume = function setVolume (volume) {
        if (this._ready) 
            { this._player.setVolume(volume); }
         else 
            { this._queueCommand('setVolume', volume); }
    };
    YouTubePlayer.prototype.setPlaybackRate = function setPlaybackRate (rate) {
        if (this._ready) 
            { this._player.setPlaybackRate(rate); }
         else 
            { this._queueCommand('setPlaybackRate', rate); }
    };
    YouTubePlayer.prototype.getVolume = function getVolume () {
        return this._ready && this._player.getVolume() || 0;
    };
    YouTubePlayer.prototype.getPlaybackRate = function getPlaybackRate () {
        return this._ready && this._player.getPlaybackRate() || 1;
    };
    YouTubePlayer.prototype.getAvailablePlaybackRates = function getAvailablePlaybackRates () {
        return this._ready && this._player.getAvailablePlaybackRates() || [1];
    };
    YouTubePlayer.prototype.getDuration = function getDuration () {
        return this._ready && this._player.getDuration() || 0;
    };
    YouTubePlayer.prototype.getProgress = function getProgress () {
        return this._ready && this._player.getVideoLoadedFraction() || 0;
    };
    YouTubePlayer.prototype.getState = function getState () {
        return this._ready && YOUTUBE_STATES[this._player.getPlayerState()] || 'unstarted';
    };
    YouTubePlayer.prototype.getCurrentTime = function getCurrentTime () {
        return this._ready && this._player.getCurrentTime() || 0;
    };
    YouTubePlayer.prototype.destroy = function destroy () {
        this._destroy();
    };
    YouTubePlayer.prototype._destroy = function _destroy (err) {
        if (this.destroyed) 
            { return; }
        this.destroyed = true;
        if (this._player) {
            this._player.stopVideo();
            this._player.destroy();
        }
        this.videoId = null;
        this._id = null;
        this._opts = null;
        this._api = null;
        this._player = null;
        this._ready = false;
        this._queue = null;
        this._stopInterval();
        this._interval = false;
        this.removeListener('playing', this._startInterval);
        this.removeListener('paused', this._stopInterval);
        this.removeListener('buffering', this._stopInterval);
        this.removeListener('unstarted', this._stopInterval);
        this.removeListener('ended', this._stopInterval);
        if (err) 
            { this.emit('error', err); }
    };
    YouTubePlayer.prototype._queueCommand = function _queueCommand (command) {
        var args = [], len = arguments.length - 1;
        while ( len-- > 0 ) args[ len ] = arguments[ len + 1 ];

        if (this.destroyed) 
            { return; }
        this._queue.push([command,args]);
    };
    YouTubePlayer.prototype._flushQueue = function _flushQueue () {
        var this$1 = this;

        while (this._queue.length) {
            var command = this$1._queue.shift();
            this$1[command[0]].apply(this$1, command[1]);
        }
    };
    YouTubePlayer.prototype._loadIframeAPI = function _loadIframeAPI (cb) {
        if (window.YT && typeof window.YT.Player === 'function') {
            return cb(null, window.YT);
        }
        loadIframeAPICallbacks.push(cb);
        var scripts = Array.from(document.getElementsByTagName('script'));
        var isLoading = scripts.some(function (script) { return script.src === YOUTUBE_IFRAME_API_SRC; });
        if (!isLoading) {
            loadScript2(YOUTUBE_IFRAME_API_SRC, function (err) {
                if (err) {
                    while (loadIframeAPICallbacks.length) {
                        var loadCb = loadIframeAPICallbacks.shift();
                        loadCb(err);
                    }
                }
            });
        }
        if (typeof window.onYouTubeIframeAPIReady !== 'function') {
            window.onYouTubeIframeAPIReady = (function () {
                while (loadIframeAPICallbacks.length) {
                    var loadCb = loadIframeAPICallbacks.shift();
                    loadCb(null, window.YT);
                }
            });
        }
    };
    YouTubePlayer.prototype._createPlayer = function _createPlayer (videoId) {
        var this$1 = this;

        if (this.destroyed) 
            { return; }
        var opts = this._opts;
        this._player = new this._api.Player(this._id, {
            width: opts.width,
            height: opts.height,
            videoId: videoId,
            playerVars: {
                autoplay: opts.autoplay ? 1 : 0,
                cc_load_policy: opts.captions != null ? opts.captions ? 1 : 0 : undefined,
                controls: opts.controls ? 2 : 0,
                disablekb: opts.keyboard ? 0 : 1,
                enablejsapi: 1,
                fs: opts.fullscreen ? 1 : 0,
                iv_load_policy: opts.annotations ? 1 : 3,
                modestbranding: 1,
                origin: window.location.origin,
                playsinline: 1,
                rel: opts.related ? 1 : 0,
                showinfo: opts.info ? 1 : 0,
                wmode: 'opaque'
            },
            events: {
                onReady: function () { return this$1._onReady(videoId); },
                onStateChange: function (data) { return this$1._onStateChange(data); },
                onPlaybackQualityChange: function (data) { return this$1._onPlaybackQualityChange(data); },
                onPlaybackRateChange: function (data) { return this$1._onPlaybackRateChange(data); },
                onError: function (data) { return this$1._onError(data); }
            }
        });
    };
    YouTubePlayer.prototype._onReady = function _onReady (videoId) {
        if (this.destroyed) 
            { return; }
        this._ready = true;
        if (videoId !== this.videoId) {
            this.load(this.videoId);
        }
        this._flushQueue();
    };
    YouTubePlayer.prototype._onStateChange = function _onStateChange (data) {
        if (this.destroyed) 
            { return; }
        var state = YOUTUBE_STATES[data.data];
        if (state) {
            if (['paused'].includes(state)) 
                { this._onTimeupdate(); }
            this.emit(state);
            if (state === 'playing') 
                { this._onTimeupdate(); }
        } else {
            throw new Error('Unrecognized state change: ' + data);
        }
    };
    YouTubePlayer.prototype._onPlaybackQualityChange = function _onPlaybackQualityChange (data) {
        if (this.destroyed) 
            { return; }
        this.emit('playbackQualityChange', data.data);
    };
    YouTubePlayer.prototype._onPlaybackRateChange = function _onPlaybackRateChange (data) {
        if (this.destroyed) 
            { return; }
        this.emit('playbackRateChange', data.data);
    };
    YouTubePlayer.prototype._onError = function _onError (data) {
        if (this.destroyed) 
            { return; }
        var code = data.data;
        if (code === YOUTUBE_ERROR.HTML5_ERROR) 
            { return; }
        if (code === YOUTUBE_ERROR.UNPLAYABLE_1 || code === YOUTUBE_ERROR.UNPLAYABLE_2 || code === YOUTUBE_ERROR.NOT_FOUND || code === YOUTUBE_ERROR.INVALID_PARAM) {
            return this.emit('unplayable', this.videoId);
        }
        this._destroy(new Error('YouTube Player Error. Unknown error code: ' + code));
    };
    YouTubePlayer.prototype._onTimeupdate = function _onTimeupdate () {
        this.emit('timeupdate', this.getCurrentTime());
    };
    YouTubePlayer.prototype._startInterval = function _startInterval () {
        var this$1 = this;

        this._interval = setInterval(function () { return this$1._onTimeupdate(); }, this._opts.timeupdateFrequency);
    };
    YouTubePlayer.prototype._stopInterval = function _stopInterval () {
        clearInterval(this._interval);
        this._interval = null;
    };

    return YouTubePlayer;
}(EventEmitter));

export default YouTubePlayer;
//# sourceMappingURL=index.m.js.map
