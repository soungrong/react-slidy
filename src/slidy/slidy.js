import detectPrefixes from './detect-prefixes.js'

const { slice } = Array.prototype
const prefixes = detectPrefixes()

const LINEAR_ANIMATION = 'linear'
const SLIDES_TO_SCROLL = 1
const VALID_SWIPE_DISTANCE = 25
const {abs, min, max, round} = Math

export function slidy (slider, options) {
  const {
    ease,
    frameDOMEl,
    infinite,
    items,
    itemsPreloaded,
    rewind,
    rewindSpeed,
    slideSpeed,
    tailArrowClass
  } = options

  // if frameDOMEl is null, then we do nothing
  if (frameDOMEl === null) return
  // DOM elements
  const slideContainerDOMEl = frameDOMEl.getElementsByClassName(options.classNameSlideContainer)[0]

  const prevArrow = frameDOMEl.getElementsByClassName(options.classNamePrevCtrl)[0]
  const nextArrow = frameDOMEl.getElementsByClassName(options.classNameNextCtrl)[0]

  // initialize some variables
  let frameWidth = 0
  let index = 0
  let loadedIndex = []
  let maxOffset = 0
  let position = 0
  let slides = []
  let transitionEndCallback

  let itemsPreloadedCount = itemsPreloaded
  while (itemsPreloadedCount--) loadedIndex[itemsPreloadedCount] = 1

  // event handling
  let touchOffset = { pageX: 0, pageY: 0 }
  let currentTouchOffset = { pageX: 0, pageY: 0 }
  let delta = { x: 0, y: 0 }
  let isScrolling = false

  // clamp a number between two min and max values
  function _clampNumber (x, minValue, maxValue) {
    return min(max(x, minValue), maxValue)
  }

  // get the width from a DOM element
  function _getWidthFromDOMEl (el) {
    return el.getBoundingClientRect().width
  }

  // calculate the offset with the width of the frame and the desired position
  function _getOffsetLeft (slidePosition) {
    return frameWidth * slidePosition
  }

  /**
   * private
   * _setupInfinite: function to setup if infinite is set
   *
   * @param  {array} slideArray
   * @return {array} array of updated slideContainer elements
   */
  function _setupInfinite (slideArray) {
    const { infinite } = options

    const totalSlides = slideArray.length
    const front = slideArray.slice(0, infinite)
    const back = slideArray.slice(totalSlides - infinite, totalSlides)
    const { firstChild } = slideContainerDOMEl

    front.forEach(function (el) {
      const cloned = el.cloneNode(true)
      slideContainerDOMEl.appendChild(cloned)
    })

    back.reverse()
      .forEach(function (el) {
        const cloned = el.cloneNode(true)
        slideContainerDOMEl.insertBefore(cloned, firstChild)
      })

    return slice.call(slideContainerDOMEl.children)
  }

  /**
   * translates to a given position in a given time in milliseconds
   *
   * @to        {number} number in pixels where to translate to
   * @duration  {number} time in milliseconds for the transistion
   * @ease      {string} easing css property
   */
  function _translate (to, duration, ease) {
    const easeCssText = ease ? `${prefixes.transitionTiming}: ${ease};` : ''
    const durationCssText = duration ? `${prefixes.transitionDuration}: ${duration}ms;` : ''
    const cssText = `${easeCssText}${durationCssText}
      ${prefixes.transform}: ${prefixes.translate(to)};`

    slideContainerDOMEl.style.cssText = cssText
  }

  function _setTailArrowClasses () {
    if (infinite === true) { return }
    if (prevArrow !== null && typeof prevArrow.classList === 'object') {
      let action = index < 1 ? 'add' : 'remove'
      prevArrow.classList[action](tailArrowClass)
    }
    if (nextArrow !== null && typeof nextArrow.classList === 'object') {
      let action = index > options.items.length - 2 ? 'add' : 'remove'
      nextArrow.classList[action](tailArrowClass)
    }
  }

  /**
   * slidefunction called by prev, next & touchend
   *
   * determine nextIndex and slide to next postion
   * under restrictions of the defined options
   *
   * @direction  {boolean} 'true' for right, 'false' for left
   */
  function slide (direction) {
    let duration = slideSpeed

    const movement = direction === true ? 1 : -1
    const totalSlides = slides.length

    // calculate the nextIndex according to the movement
    let nextIndex = index + (SLIDES_TO_SCROLL * movement)

    // nextIndex should be between 0 and totalSlides minus 1
    nextIndex = _clampNumber(nextIndex, 0, totalSlides - 1)

    if (infinite === true && direction === undefined) {
      nextIndex += infinite
    }

    let nextOffset = _clampNumber(_getOffsetLeft(nextIndex) * -1, maxOffset * -1, 0)

    if (rewind && direction && abs(position) === maxOffset) {
      nextOffset = 0
      nextIndex = 0
      duration = rewindSpeed
    }

    const needToSlide = nextIndex !== index
    if (needToSlide === false) return

    // translate to the nextOffset by a defined duration and ease function
    _translate(nextOffset, duration, ease)

    // update the position with the next position
    position = nextOffset

    // if the nextIndex is possible according to totalSlides, then use it
    if (nextIndex <= totalSlides) {
      options.doBeforeSlide({ currentSlide: index, nextSlide: nextIndex })
      index = nextIndex
    }

    if (infinite && (nextIndex === totalSlides - infinite || nextIndex === 0)) {
      index = direction ? infinite : totalSlides - (infinite * 2)

      position = _getOffsetLeft(index) * -1

      transitionEndCallback = function () {
        _translate(_getOffsetLeft(index) * -1, 0)
      }
    } else {
      const indexToLoad = index + (SLIDES_TO_SCROLL * movement) - 1
      // check if the slide has been loaded before
      const indexLoaded = !!loadedIndex[indexToLoad]
      if (indexToLoad < totalSlides && indexToLoad >= 0 && !indexLoaded) {
        // insert in the correct position
        slideContainerDOMEl.appendChild(slides[indexToLoad])
        loadedIndex[indexToLoad] = 1
      }
    }

    // Checking wheter to paint or hide the arrows.
    _setTailArrowClasses()

    options.doAfterSlide({ currentSlide: index })
  }

  function _removeTouchEventsListeners (all = false) {
    frameDOMEl.removeEventListener('touchmove', onTouchmove)
    frameDOMEl.removeEventListener('touchend', onTouchend)
    frameDOMEl.removeEventListener('touchcancel', onTouchend)
    if (all === true) {
      frameDOMEl.removeEventListener('touchstart', onTouchstart)
    }
  }

  function _removeAllEventsListeners () {
    _removeTouchEventsListeners(true)
    slideContainerDOMEl.removeEventListener(prefixes.transitionEnd, onTransitionEnd)
    window.removeEventListener('resize', onResize)
  }

  function onTransitionEnd () {
    if (typeof transitionEndCallback === 'function') {
      transitionEndCallback()
      transitionEndCallback = undefined
    }
  }

  function getTouchCoordinatesFromEvent ({ event }) {
    return event.targetTouches ? event.targetTouches[0] : event
  }

  function onTouchstart (event) {
    const { pageX, pageY } = getTouchCoordinatesFromEvent({ event })
    touchOffset = currentTouchOffset = { pageX, pageY }
    frameDOMEl.addEventListener('touchmove', onTouchmove, { pasive: true })
    frameDOMEl.addEventListener('touchend', onTouchend, { pasive: true })
    frameDOMEl.addEventListener('touchcancel', onTouchend, { pasive: true })
  }

  function onTouchmove (event) {
    const { pageX, pageY } = getTouchCoordinatesFromEvent({ event })

    delta = {
      x: pageX - touchOffset.pageX,
      y: pageY - touchOffset.pageY
    }

    const deltaNow = {
      x: pageX - currentTouchOffset.pageX,
      y: pageY - currentTouchOffset.pageY
    }

    currentTouchOffset = { pageX, pageY }

    const isScrollingNow = abs(deltaNow.x) < abs(deltaNow.y)
    isScrolling = !!(isScrolling || isScrollingNow)

    if (navigator.userAgent.indexOf('Android 4.3') >= 0 && isScrollingNow === false) {
      event.preventDefault()
    }

    if (isScrolling === false && delta.x !== 0) {
      _translate(Math.round(position + delta.x), 0)
    } else if (isScrolling === true) {
      onTouchend(event)
    }
  }

  function onTouchend (event) {
    /**
     * is valid if:
     * -> swipe distance is greater than the specified valid swipe distance
     * -> swipe distance is more then a third of the swipe area
     * @isValidSlide {Boolean}
     */
    const absoluteX = abs(delta.x)
    const isValid = absoluteX > VALID_SWIPE_DISTANCE || absoluteX > frameWidth / 3

    /**
     * is out of bounds if:
     * -> index is 0 and delta x is greater than 0
     * -> index is the last slide and delta is smaller than 0
     * @isOutOfBounds {Boolean}
     */
    const direction = delta.x < 0
    const isOutOfBounds = (!index && !direction) ||
        (index === slides.length - 1 && direction)

    if (isValid === true && isOutOfBounds === false) {
      slide(direction)
    } else {
      _translate(position, options.snapBackSpeed, LINEAR_ANIMATION)
    }

    delta = {}
    touchOffset = {}
    isScrolling = false

    _removeTouchEventsListeners()
  }

  function _convertItemToDOM (string) {
    const wrappedString = `<li class='${options.classNameItem}'>${string}</li>`
    const el = document.createElement('template')
    if (typeof el.content === 'object') {
      el.innerHTML = wrappedString
      return el.content
    } else {
      const container = document.createElement('ul')
      const fragment = document.createDocumentFragment()
      container.innerHTML = wrappedString
      while (container.firstChild !== null) {
        fragment.appendChild(container.firstChild)
      }
      return fragment
    }
  }

  function onResize (event) {
    reset()
  }

  /**
   * public
   * setup function
   */
  function _setup () {
    const { infinite } = options
    const slidesArray = slice.call(items.map(_convertItemToDOM))
    position = slideContainerDOMEl.offsetLeft

    slides = infinite === true ? _setupInfinite(slidesArray) : slice.call(slidesArray)

    _setTailArrowClasses()
    reset()

    slideContainerDOMEl.addEventListener(prefixes.transitionEnd, onTransitionEnd)
    frameDOMEl.addEventListener('touchstart', onTouchstart)
    window.addEventListener('resize', onResize)
  }

  /**
   * public
   * reset function: called on resize
   */
  function reset () {
    const {infinite, rewindOnResize} = options
    let { ease, rewindSpeed } = options

    frameWidth = _getWidthFromDOMEl(frameDOMEl)
    maxOffset = round((frameWidth * slides.length) - frameWidth)

    if (rewindOnResize === true) {
      index = 0
    } else {
      ease = null
      rewindSpeed = 0
    }

    const offsetIndex = infinite ? index + infinite : index
    const newX = _getOffsetLeft(offsetIndex) * -1
    if (infinite === true) {
      _translate(newX, 0)
    } else {
      _translate(newX, rewindSpeed, ease)
    }
    index = offsetIndex
    position = newX
  }

  /**
   * public
   * returnIndex function: called on clickhandler
   */
  function returnIndex () {
    return index - options.infinite || 0
  }

  /**
   * public
   * prev function: called on clickhandler
   */
  function prev () {
    slide(false)
  }

  /**
   * public
   * next function: called on clickhandler
   */
  function next () {
    slide(true)
  }

  /**
   * public
   * destroy function: called to gracefully destroy the slidy instance
   */
  function destroy () {
    const { infinite } = options
    _removeAllEventsListeners()
    // remove cloned slides if infinite is set
    if (infinite === true) {
      const {firstChild, lastChild} = slideContainerDOMEl
      Array.apply(null, Array(infinite)).forEach(function () {
        slideContainerDOMEl.removeChild(firstChild)
        slideContainerDOMEl.removeChild(lastChild)
      })
    }
  }

  // trigger initial setup
  _setup()

  // expose public api
  return {
    reset,
    slide,
    returnIndex,
    prev,
    next,
    destroy
  }
}
