import L from 'leaflet'

export const TrackPlayBackControl = L.Control.extend({

  includes: L.Evented.prototype,

  options: {
    position: 'bottomleft'
  },

  initialize: function (trackplayback, options) {
    L.Control.prototype.initialize.call(this, options)
    this.trackPlayBack = trackplayback
    this.trackPlayBack.on('tick', this._tickCallback, this)
  },

  onAdd: function (map) {
    this._initContainer()
    return this._container
  },

  onRemove: function (map) {
    this.trackPlayBack.dispose()
    this.trackPlayBack.off('tick', this._tickCallback, this)
  },

  formatDay: function (date) {
    if (date > 3 && date < 21) return 'th'
    switch (date % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  },

  formatTime: function (date) {
    var hours = date.getHours()
    var minutes = date.getMinutes()
    var ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours || 12 // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes
    var strTime = hours + ':' + minutes + ' ' + ampm
    return strTime
  },

  formatDate: function (timestamp) {
    var date = new Date(timestamp * 1000)
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    return days[date.getDay()] + ', ' + date.getDate() + this.formatDay(date.getDate()) + ' ' + months[date.getMonth()] + ' ' + date.getFullYear() + ' ' + this.formatTime(date)
  },

  _initContainer: function () {
    var className = 'leaflet-control-playback'
    this._container = L.DomUtil.create('div', className)
    L.DomEvent.disableClickPropagation(this._container)

    this._topContainer = this._createContainer('topContainer', this._container)
    this._bottomContainer = this._createContainer('bottomContainer', this._container)

    this._timeContainer = this._createContainer('timeContainer', this._topContainer)
    this._buttonContainer = this._createContainer('buttonContainer', this._bottomContainer)
    this._sliderContainer = this._createContainer('sliderContainer', this._bottomContainer)

    this._time = this._createTime(this.formatDate(this.trackPlayBack.getCurTime()), 'time-info', this._timeContainer)

    this._playBtn = this._createButton('Play', 'btn-stop', this._buttonContainer, this._play)
    this._restartBtn = this._createButton('Restart', 'btn-restart', this._buttonContainer, this._restart)
    this._slowSpeedBtn = this._createButton('Slower', 'btn-slow', this._buttonContainer, this._slow)
    this._quickSpeedBtn = this._createButton('Faster', 'btn-quick', this._buttonContainer, this._quick)

    this._slider = this._createSlider('time-slider', this._sliderContainer, this._scrollchange)

    return this._container
  },

  _createContainer: function (className, container) {
    return L.DomUtil.create('div', className, container)
  },

  _createButton: function (title, className, container, fn) {
    var link = L.DomUtil.create('a', 'button', container)
    link.href = '#'
    link.title = title
    link.setAttribute('role', 'button')
    link.setAttribute('aria-label', title)
    L.DomEvent.disableClickPropagation(link)
    L.DomEvent.on(link, 'click', fn, this)

    return L.DomUtil.create('div', className, link)
  },

  _createSlider: function (className, container, fn) {
    let sliderEle = L.DomUtil.create('input', className, container)
    sliderEle.setAttribute('type', 'range')
    sliderEle.setAttribute('min', this.trackPlayBack.getStartTime())
    sliderEle.setAttribute('max', this.trackPlayBack.getEndTime())
    sliderEle.setAttribute('value', this.trackPlayBack.getCurTime())
    sliderEle.setAttribute('title', this.formatDate(this.trackPlayBack.getCurTime()))

    L.DomEvent.on(sliderEle, 'click mousedown dbclick', L.DomEvent.stopPropagation)
      .on(sliderEle, 'click', L.DomEvent.preventDefault)
      .on(sliderEle, 'change', fn, this)
      .on(sliderEle, 'input', fn, this)

    return sliderEle
  },

  _createTime: function (info, className, container) {
    let timeInfo = L.DomUtil.create('span', className, container)
    timeInfo.innerHTML = info
    return timeInfo
  },

  _play: function () {
    let hasClass = L.DomUtil.hasClass(this._playBtn, 'btn-stop')
    if (hasClass) {
      L.DomUtil.removeClass(this._playBtn, 'btn-stop')
      L.DomUtil.addClass(this._playBtn, 'btn-start')
      this._playBtn.setAttribute('title', 'Stop')
      this.trackPlayBack.start()
    } else {
      L.DomUtil.removeClass(this._playBtn, 'btn-start')
      L.DomUtil.addClass(this._playBtn, 'btn-stop')
      this._playBtn.setAttribute('title', 'Play')
      this.trackPlayBack.stop()
    }
  },

  _restart: function () {
    // Playback changes play button style
    L.DomUtil.removeClass(this._playBtn, 'btn-stop')
    L.DomUtil.addClass(this._playBtn, 'btn-start')
    this._playBtn.setAttribute('title', 'Stop')
    this.trackPlayBack.rePlaying()
  },

  _slow: function () {
    this.trackPlayBack.slowSpeed()
  },

  _quick: function () {
    this.trackPlayBack.quickSpeed()
  },

  _close: function () {
    L.DomUtil.remove(this._container)
    if (this.onRemove) {
      this.onRemove(this._map)
    }
    return this
  },

  _scrollchange: function (e) {
    let val = Number(e.target.value)
    this.trackPlayBack.setCursor(val)
    if (e.type === 'change') {
      this.fire('change', {
        trackPoints: this.trackPlayBack.getTrackPoints()
      })
    }
  },

  _tickCallback: function (e) {
    this._slider.value = e.time
    this._time.innerHTML = this.formatDate(e.time)
    this._slider.setAttribute('title', this.formatDate(e.time))
    // Change play button style after playback ends
    if (e.time >= this.trackPlayBack.getEndTime()) {
      L.DomUtil.removeClass(this._playBtn, 'btn-start')
      L.DomUtil.addClass(this._playBtn, 'btn-stop')
      this._playBtn.setAttribute('title', 'Play')
      this.trackPlayBack.stop()
    }
  }
})

export const trackplaybackcontrol = function (trackplayback, options) {
  return new TrackPlayBackControl(trackplayback, options)
}
