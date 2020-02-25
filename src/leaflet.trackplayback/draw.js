import L from 'leaflet'

import { TrackLayer } from './tracklayer'

/**
 * Drawing class
 * Complete the drawing of trajectory lines, trajectory points and targets
 */
export const Draw = L.Layer.extend({
  trackPointOptions: {
    isDraw: true,
    useCanvas: true,
    stroke: true,
    color: '#000',
    fill: true,
    fillColor: '#278edd',
    opacity: 1,
    radius: 5
  },
  trackLineOptions: {
    isDraw: true,
    stroke: true,
    color: '#278edd',
    weight: 2,
    fill: false,
    fillColor: '#278edd',
    opacity: 1
  },
  targetOptions: {
    useImg: false,
    imgUrl: '../../static/images/ship.png',
    showText: false,
    width: 8,
    height: 18,
    color: '#000', // stroke color
    fillColor: '#89c257'
  },
  toolTipOptions: {
    offset: [0, 0],
    direction: 'top',
    permanent: true
  },
  circleOptions: {
    fillColor: '#278edd'
  },
  shipRadiusOptions: {
    color: '#89c257',
    fillColor: '#89c257'
  },

  initialize: function (map, options) {
    L.extend(this.trackPointOptions, options.trackPointOptions)
    L.extend(this.trackLineOptions, options.trackLineOptions)
    L.extend(this.targetOptions, options.targetOptions)
    L.extend(this.toolTipOptions, options.toolTipOptions)

    this._showTrackPoint = this.trackPointOptions.isDraw
    this._showTrackLine = this.trackLineOptions.isDraw

    this._map = map
    this._map.on('mousemove', this._onmousemoveEvt, this)
    this._map.on('click', this._onmouseclickEvt, this)

    this._trackLayer = new TrackLayer().addTo(map)
    this._trackLayer.on('update', this._trackLayerUpdate, this)

    this._canvas = this._trackLayer.getContainer()
    this._ctx = this._canvas.getContext('2d')

    this._bufferTracks = []

    if (!this.trackPointOptions.useCanvas) {
      this._trackPointFeatureGroup = L.featureGroup([]).addTo(map)
    }

    // If using a target, load the image first
    if (this.targetOptions.useImg) {
      const img = new Image()
      img.onload = () => {
        this._targetImg = img
      }
      img.onerror = () => {
        throw new Error('img load error!')
      }
      img.src = this.targetOptions.imgUrl
    }
  },

  update: function () {
    this._trackLayerUpdate()
  },

  drawTrack: function (trackpoints) {
    this._bufferTracks.push(trackpoints)
    this._drawTrack(trackpoints)
  },

  showTrackPoint: function () {
    this._showTrackPoint = true
    this.update()
  },

  hideTrackPoint: function () {
    this._showTrackPoint = false
    this.update()
  },

  showTrackLine: function () {
    this._showTrackLine = true
    this.update()
  },

  hideTrackLine: function () {
    this._showTrackLine = false
    this.update()
  },

  remove: function () {
    this._bufferTracks = []
    this._trackLayer.off('update', this._trackLayerUpdate, this)
    this._map.off('mousemove', this._onmousemoveEvt, this)
    this._map.off('click', this._onmouseclickEvt, this)
    if (this._map.hasLayer(this._trackLayer)) {
      this._map.removeLayer(this._trackLayer)
    }
    if (this._map.hasLayer(this._trackPointFeatureGroup)) {
      this._map.removeLayer(this._trackPointFeatureGroup)
    }
    if (this._map.hasLayer(this._tooltip)) {
      this._map.removeLayer(this._tooltip)
    }
    if (this._map.hasLayer(this._circle)) {
      this._map.removeLayer(this._circle)
    }
    if (this._map.hasLayer(this._shipRadius)) {
      this._map.removeLayer(this._shipRadius)
    }
  },

  clear: function () {
    this._clearLayer()
    this._bufferTracks = []
  },

  _trackLayerUpdate: function () {
    if (this._bufferTracks.length) {
      this._clearLayer()
      this._bufferTracks.forEach(
        function (element, index) {
          this._drawTrack(element)
        }.bind(this)
      )
    }
  },

  _onmousemoveEvt: function (e) {
    if (this._map.hasLayer(this._tooltip)) {
      this._map.removeLayer(this._tooltip)
    }
    if (this._map.hasLayer(this._circle)) {
      this._map.removeLayer(this._circle)
    }
    if (!this._showTrackPoint) {
      this._canvas.style.cursor = 'grab'
      return
    }
    let point = e.layerPoint
    if (this._bufferTracks.length) {
      for (let i = 0, leni = this._bufferTracks.length; i < leni; i++) {
        for (let j = 0, len = this._bufferTracks[i].length; j < len; j++) {
          let tpoint = this._getLayerPoint(this._bufferTracks[i][j])
          if (point.distanceTo(tpoint) <= this.trackPointOptions.radius) {
            this._canvas.style.cursor = 'pointer'
            this._opentoolTip(this._bufferTracks[i][j])
            return
          }
        }
      }
    }
    this._canvas.style.cursor = 'grab'
  },

  _onmouseclickEvt: function (e) {
    if (this._map.hasLayer(this._tooltip)) {
      this._map.removeLayer(this._tooltip)
    }
    if (this._map.hasLayer(this._circle)) {
      this._map.removeLayer(this._circle)
    }
    let point = e.layerPoint
    if (this._bufferTracks.length) {
      for (let i = 0, leni = this._bufferTracks.length; i < leni; i++) {
        for (let j = 0, len = this._bufferTracks[i].length; j < len; j++) {
          let tpoint = this._getLayerPoint(this._bufferTracks[i][j])
          if (point.distanceTo(tpoint) <= this.trackPointOptions.radius) {
            this.fire('click', this._bufferTracks[i][j])
            this._opentoolTip(this._bufferTracks[i][j])
            return
          }
        }
      }
    }
  },

  _opentoolTip: function (trackpoint) {
    let latlng = L.latLng(trackpoint.lat, trackpoint.lng)

    if (trackpoint.info) {
      let tooltip = (this._tooltip = L.tooltip(this.toolTipOptions))
      tooltip.setLatLng(latlng)
      tooltip.addTo(this._map)
      tooltip.setContent(this._getTooltipText(trackpoint))
    }

    if (trackpoint.radius) {
      let circle = (this._circle = L.circle(latlng, this.circleOptions))
      circle.setRadius(trackpoint.radius)
      circle.addTo(this._map)
    }
  },

  _drawTrack: function (trackpoints) {
    // Trajectory line
    if (this._showTrackLine) {
      this._drawTrackLine(trackpoints)
    }
    // Trajectory points drawn
    if (this._showTrackPoint) {
      if (this.trackPointOptions.useCanvas) {
        this._drawTrackPointsCanvas(trackpoints)
      } else {
        this._drawTrackPointsSvg(trackpoints)
      }
    }
    // Drawing ship
    let targetPoint = trackpoints[trackpoints.length - 1]
    if (this.targetOptions.useImg && this._targetImg) {
      this._drawShipRadius(targetPoint)
      this._drawShipImage(targetPoint)
    } else {
      this._drawShipRadius(targetPoint)
      this._drawShipCanvas(targetPoint)
    }
  },

  _drawTrackLine: function (trackpoints) {
    let options = this.trackLineOptions
    let tp0 = this._getLayerPoint(trackpoints[0])
    this._ctx.save()
    this._ctx.beginPath()
    // Trajectory line
    this._ctx.moveTo(tp0.x, tp0.y)
    for (let i = 1, len = trackpoints.length; i < len; i++) {
      let tpi = this._getLayerPoint(trackpoints[i])
      this._ctx.lineTo(tpi.x, tpi.y)
    }
    this._ctx.globalAlpha = options.opacity
    if (options.stroke) {
      this._ctx.strokeStyle = options.color
      this._ctx.lineWidth = options.weight
      this._ctx.stroke()
    }
    if (options.fill) {
      this._ctx.fillStyle = options.fillColor
      this._ctx.fill()
    }
    this._ctx.restore()
  },

  _drawTrackPointsCanvas: function (trackpoints) {
    let options = this.trackPointOptions
    this._ctx.save()
    for (let i = 0, len = trackpoints.length; i < len; i++) {
      if (trackpoints[i].isOrigin) {
        let latLng = L.latLng(trackpoints[i].lat, trackpoints[i].lng)
        let radius = options.radius
        let point = this._map.latLngToLayerPoint(latLng)
        this._ctx.beginPath()
        this._ctx.arc(point.x, point.y, radius, 0, Math.PI * 2, false)
        this._ctx.globalAlpha = options.opacity
        if (options.stroke) {
          this._ctx.strokeStyle = options.color
          this._ctx.stroke()
        }
        if (options.fill) {
          this._ctx.fillStyle = options.fillColor
          this._ctx.fill()
        }
      }
    }
    this._ctx.restore()
  },

  _drawTrackPointsSvg: function (trackpoints) {
    for (let i = 0, len = trackpoints.length; i < len; i++) {
      if (trackpoints[i].isOrigin) {
        let latLng = L.latLng(trackpoints[i].lat, trackpoints[i].lng)
        let cricleMarker = L.circleMarker(latLng, this.trackPointOptions)
        cricleMarker.bindTooltip(
          this._getTooltipText(trackpoints[i]),
          this.toolTipOptions
        )
        this._trackPointFeatureGroup.addLayer(cricleMarker)
      }
    }
  },

  _drawtxt: function (text, trackpoint) {
    let point = this._getLayerPoint(trackpoint)
    this._ctx.save()
    this._ctx.font = '12px Verdana'
    this._ctx.fillStyle = '#000'
    this._ctx.textAlign = 'center'
    this._ctx.textBaseline = 'bottom'
    this._ctx.fillText(text, point.x, point.y - 12, 200)
    this._ctx.restore()
  },

  _drawShipCanvas: function (trackpoint) {
    let point = this._getLayerPoint(trackpoint)
    let rotate = trackpoint.dir || 0
    let w = this.targetOptions.width
    let h = this.targetOptions.height
    let dh = h / 3

    this._ctx.save()
    this._ctx.fillStyle = this.targetOptions.fillColor
    this._ctx.strokeStyle = this.targetOptions.color
    this._ctx.translate(point.x, point.y)
    this._ctx.rotate((Math.PI / 180) * rotate)
    this._ctx.beginPath()
    this._ctx.moveTo(0, 0 - h / 2)
    this._ctx.lineTo(0 - w / 2, 0 - h / 2 + dh)
    this._ctx.lineTo(0 - w / 2, 0 + h / 2)
    this._ctx.lineTo(0 + w / 2, 0 + h / 2)
    this._ctx.lineTo(0 + w / 2, 0 - h / 2 + dh)
    this._ctx.closePath()
    this._ctx.fill()
    this._ctx.stroke()

    this._ctx.restore()
  },

  // Draw estimated accuracy radius of current location
  _drawShipRadius: function (trackpoint) {
    if (this._map.hasLayer(this._shipRadius)) {
      this._map.removeLayer(this._shipRadius)
    }

    let latlng = L.latLng(trackpoint.lat, trackpoint.lng)
    let circle = (this._shipRadius = L.circle(latlng, this.shipRadiusOptions))
    circle.setRadius(trackpoint.radius)
    circle.addTo(this._map)
  },

  _drawShipImage: function (trackpoint) {
    let point = this._getLayerPoint(trackpoint)
    let dir = trackpoint.dir || 0
    let width = this.targetOptions.width
    let height = this.targetOptions.height
    let offset = {
      x: width / 2,
      y: height / 2
    }
    this._ctx.save()
    this._ctx.translate(point.x, point.y)
    this._ctx.rotate((Math.PI / 180) * dir)
    this._ctx.drawImage(
      this._targetImg,
      0 - offset.x,
      0 - offset.y,
      width,
      height
    )
    this._ctx.restore()
  },

  _getTooltipText: function (targetobj) {
    let content = []
    content.push('<table>')
    if (targetobj.ts) {
      content.push('<tr>')
      content.push(targetobj.ts)
      content.push('</tr>')
    }
    if (targetobj.info && targetobj.info.length) {
      for (let i = 0, len = targetobj.info.length; i < len; i++) {
        content.push('<tr>')
        content.push('<td>' + targetobj.info[i].key + '</td>')
        content.push('<td>' + targetobj.info[i].value + '</td>')
        content.push('</tr>')
      }
    }
    content.push('</table>')
    content = content.join('')
    return content
  },

  _clearLayer: function () {
    let bounds = this._trackLayer.getBounds()
    if (bounds) {
      let size = bounds.getSize()
      this._ctx.clearRect(bounds.min.x, bounds.min.y, size.x, size.y)
    } else {
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
    }
    if (this._map.hasLayer(this._trackPointFeatureGroup)) {
      this._trackPointFeatureGroup.clearLayers()
    }
  },

  _getLayerPoint: function (trackpoint) {
    return this._map.latLngToLayerPoint(
      L.latLng(trackpoint.lat, trackpoint.lng)
    )
  }
})

export const draw = function (map, options) {
  return new Draw(map, options)
}
