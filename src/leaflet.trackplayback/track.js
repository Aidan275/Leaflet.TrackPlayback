import L from 'leaflet'

import {
  isArray
} from './util'

/**
 * Track class
 */
export const Track = L.Layer.extend({

  initialize: function (trackData = [], options) {
    L.setOptions(this, options)

    trackData.forEach(item => {
      // Added the isOrigin field to identify whether it is the original sampling
      // point and distinguish it from the interpolation point
      item.isOrigin = true
    })
    this._trackPoints = trackData
    this._timeTick = {}
    this._update()
  },

  addTrackPoint: function (trackPoint) {
    if (isArray(trackPoint)) {
      for (let i = 0, len = trackPoint.length; i < len; i++) {
        this.addTrackPoint(trackPoint[i])
      }
    }
    this._addTrackPoint(trackPoint)
  },

  getTimes: function () {
    let times = []
    for (let i = 0, len = this._trackPoints.length; i < len; i++) {
      times.push(this._trackPoints[i].time)
    }
    return times
  },

  getStartTrackPoint: function () {
    return this._trackPoints[0]
  },

  getEndTrackPoint: function () {
    return this._trackPoints[this._trackPoints.length - 1]
  },

  getTrackPointByTime: function (time) {
    return this._trackPoints[this._timeTick[time]]
  },

  getAllTrackPoints: function () {
    return this._trackPoints
  },

  _formatDistance: function (distance) {
    return distance < 1000
      ? `${distance.toFixed(2)} m`
      : `${(distance / 1000).toFixed(2)} km`
  },

  _getCalculateTrackPointByTime: function (time) {
    // First determine whether the last point is the original point
    let endpoint = this.getTrackPointByTime(time)
    let startPt = this.getStartTrackPoint()
    let endPt = this.getEndTrackPoint()
    let times = this.getTimes()
    if (time < startPt.time || time > endPt.time) return
    let left = 0
    let right = times.length - 1
    let n
    // Handle only one point case
    if (left === right) {
      return endpoint
    }
    // [Binary search] method to find out the time interval of the current time
    while (right - left !== 1) {
      n = parseInt((left + right) / 2)
      if (time > times[n]) left = n
      else right = n
    }

    let t0 = times[left]
    let t1 = times[right]
    let t = time
    let p0 = this.getTrackPointByTime(t0)
    let p1 = this.getTrackPointByTime(t1)
    startPt = L.point(p0.lng, p0.lat)
    endPt = L.point(p1.lng, p1.lat)
    let s = startPt.distanceTo(endPt)
    // At the same point at different times
    if (s <= 0) {
      endpoint = p1
      return endpoint
    }
    // Suppose the target moves in a straight line at a uniform speed between two points
    // Find the velocity vector and calculate the time t where the target is
    let v = s / (t1 - t0)
    let r = (p1.radius - p0.radius) / (t1 - t0)
    let sinx = (endPt.y - startPt.y) / s
    let cosx = (endPt.x - startPt.x) / s
    let step = v * (t - t0)
    let rstep = r * (t - t0)
    let x = startPt.x + step * cosx
    let y = startPt.y + step * sinx
    let radius = p0.radius + rstep
    // Find the direction of movement of the target, 0-360 degrees
    let dir = endPt.x >= startPt.x ? (Math.PI * 0.5 - Math.asin(sinx)) * 180 / Math.PI : (Math.PI * 1.5 + Math.asin(sinx)) * 180 / Math.PI

    if (endpoint) {
      if (endpoint.dir === undefined) {
        endpoint.dir = dir
      }
      if (endpoint.radius === undefined) {
        endpoint.radius = radius
      }
    } else {
      endpoint = {
        lng: x,
        lat: y,
        dir: dir,
        isOrigin: false,
        time: time,
        radius: radius,
        info: [
          {
            key: 'Accuracy:',
            value: this._formatDistance(radius)
          }
        ]
      }
    }
    return endpoint
  },

  // Get the trajectory before a certain point in time
  getTrackPointsBeforeTime: function (time) {
    let tpoints = []
    for (let i = 0, len = this._trackPoints.length; i < len; i++) {
      if (this._trackPoints[i].time < time) {
        tpoints.push(this._trackPoints[i])
      }
    }
    // Get the last point, linearly interpolated from time
    let endPt = this._getCalculateTrackPointByTime(time)
    if (endPt) {
      tpoints.push(endPt)
    }
    return tpoints
  },

  _addTrackPoint: function (trackPoint) {
    trackPoint.isOrigin = true
    this._trackPoints.push(trackPoint)
    this._update()
  },

  _update: function () {
    this._sortTrackPointsByTime()
    this._updatetimeTick()
  },

  // Track points are sorted by time [bubble sort]
  _sortTrackPointsByTime: function () {
    let len = this._trackPoints.length
    for (let i = 0; i < len; i++) {
      for (let j = 0; j < len - 1 - i; j++) {
        if (this._trackPoints[j].time > this._trackPoints[j + 1].time) {
          let tmp = this._trackPoints[j + 1]
          this._trackPoints[j + 1] = this._trackPoints[j]
          this._trackPoints[j] = tmp
        }
      }
    }
  },

  // Time indexing of trajectory points to optimize search performance
  _updatetimeTick: function () {
    this._timeTick = {}
    for (let i = 0, len = this._trackPoints.length; i < len; i++) {
      this._timeTick[this._trackPoints[i].time] = i
    }
  }
})

export const track = function (trackData, options) {
  return new Track(trackData, options)
}
