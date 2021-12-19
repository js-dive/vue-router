/* @flow */

import type Router from '../index'
import { History } from './base'
import { cleanPath } from '../util/path'
import { getLocation } from './html5'
import { setupScroll, handleScroll } from '../util/scroll'
import { pushState, replaceState, supportsPushState } from '../util/push-state'

export class HashHistory extends History {
  constructor (router: Router, base: ?string, fallback: boolean) {
    super(router, base)
    // check history fallback deeplinking
    if (fallback && checkFallback(this.base)) {
      return
    }
    // hash 路由在构建时首先会ensure，以确保目前地址栏中地址格式正确，然后才进行setupListeners的操作
    ensureSlash()
  }

  // 页面进入时首次初始化listener
  // this is delayed until the app mounts
  // to avoid the hashchange listener being fired too early
  setupListeners () {
    if (this.listeners.length > 0) {
      return
    }

    const router = this.router
    const expectScroll = router.options.scrollBehavior
    const supportsScroll = supportsPushState && expectScroll

    if (supportsScroll) {
      this.listeners.push(setupScroll())
    }

    // popstate/hashchange 处理函数，主要用于监听点击浏览器前进或后退按钮，以及手动在地址栏中改变hash的情况
    // 如果不添加hashchange事件，浏览器前进后退按钮将会无效
    // 表现为：前进/后退按钮按下（或手动在地址栏中输入改变hash），浏览器地址栏中的地址会产生变化，但视图不会更新
    // 但此时点击视图中触发路由变化的地方，视图还是可以更新
    const handleRoutingEvent = () => {
      const current = this.current
      console.log('Will ensureSlash be executed again?')
      // 如果这里发现hash不是以/开头的，那就什么也不做，同时（在ensureSlash）执行一次replaceHash跳转，以确保路由以/开头
      // 跳转类似：#12345 -> #/12345
      // ensureSlash后，将会导致hashchange处理函数被触发一次
      if (!ensureSlash()) {
        return
      }
      this.transitionTo(getHash(), route => {
        if (supportsScroll) {
          handleScroll(this.router, route, current, true)
        }
        // 不支持history时，将会使用window.location.replace来进行跳转
        if (!supportsPushState) {
          replaceHash(route.fullPath)
        }
      }) // 这里没有传入onAbort回调，因此onAbort时不会发生任何事
    }
    const eventType = supportsPushState ? 'popstate' : 'hashchange'
    window.addEventListener(
      eventType,
      handleRoutingEvent
    )
    this.listeners.push(() => {
      window.removeEventListener(eventType, handleRoutingEvent)
    })
  }

  push (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        pushHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  replace (location: RawLocation, onComplete?: Function, onAbort?: Function) {
    const { current: fromRoute } = this
    this.transitionTo(
      location,
      route => {
        replaceHash(route.fullPath)
        handleScroll(this.router, route, fromRoute, false)
        onComplete && onComplete(route)
      },
      onAbort
    )
  }

  go (n: number) {
    window.history.go(n)
  }

  ensureURL (push?: boolean) {
    const current = this.current.fullPath
    if (getHash() !== current) {
      push ? pushHash(current) : replaceHash(current)
    }
  }

  getCurrentLocation () {
    return getHash()
  }
}

function checkFallback (base) {
  const location = getLocation(base)
  if (!/^\/#/.test(location)) {
    window.location.replace(cleanPath(base + '/#' + location))
    return true
  }
}

// 检查并确保页面链接中包含hash
function ensureSlash (): boolean {
  const path = getHash()
  // 如果得到的hash以/开头，说明hash是正确的，此时不必做任何事
  if (path.charAt(0) === '/') {
    return true
  }
  // 如果不是的话，需要给路径前拼上/并跳转一下
  console.log('beforeReplaceHash')
  pushHash('/' + path)
  console.log('afterReplaceHash')
  return false
}

// 获得路由的hash，也就是第一个#之后的所有字符。
export function getHash (): string {
  // We can't use window.location.hash here because it's not
  // consistent across browsers - Firefox will pre-decode it!
  let href = window.location.href
  const index = href.indexOf('#')
  // empty path
  if (index < 0) return ''

  href = href.slice(index + 1)

  return href
}

function getUrl (path) {
  const href = window.location.href
  const i = href.indexOf('#')
  const base = i >= 0 ? href.slice(0, i) : href
  return `${base}#${path}`
}

function pushHash (path) {
  if (supportsPushState) {
    pushState(getUrl(path))
  } else {
    window.location.hash = path
  }
}

function replaceHash (path) {
  if (supportsPushState) {
    replaceState(getUrl(path))
  } else {
    window.location.replace(getUrl(path))
  }
}
