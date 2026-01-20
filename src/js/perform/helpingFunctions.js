// sideex lib to extract all possible paths to get the element
import LocatorBuilders from '../helpers/locator-builders'
const locatorBuilders = new LocatorBuilders(window)





/**
 * @param  {string} key - actual string to find in the page
 * @param  {Array} visionResponse - the response from google vision api
 */
export const getBestMatchingString = function(key, visionResponse) {
	var key_l = key.toLowerCase().replace(/\s/g,'');
	console.log(key_l);
	var meta_keys = Object.keys(visionResponse);
	var matched_keys = meta_keys.filter(function(s){
		var s1 = s.replace(/\s/g,'');
		console.log(s1, key_l);
		if(s1.includes(key_l)){
			console.log("Found..");

			return s;
		}
	})
	var distance = 999;
	var selected = null;
	for(var j in matched_keys){
		var i = matched_keys[j];
		var calc_distance = levenshteinDistance(i, key);
		if(calc_distance < distance){
			selected = i;
			distance = calc_distance;
		}
	}
	if(selected !== null){
		return visionResponse[selected];
	}
	return null;
}

export const getBestMatchingInputText = function(coords){
	let distance = 999999;
	let found = [];
	let found_ele = null;
	let elements = document.getElementsByTagName("input");

	for(let element of elements){
		var rect = element.getBoundingClientRect();
		var a = coords[0] - rect.left;
		var b = coords[1] - rect.top;

		var c = Math.sqrt( a*a + b*b );
		console.log(c);
		if(c < distance){
			distance = c;
			found = [rect.left, rect.top, rect.right, rect.bottom];
			console.log(found);
			console.log("Mapped distance", element);
			found_ele = element;
		}
	}
	console.log("Found element at --> ", found);
	return found;

}


/**
 * @description get the nearest element
 */
const levenshteinDistance = function(a, b){
	if(a.length == 0) return b.length
	if(b.length == 0) return a.length

	var matrix = [];
	a = a.toLowerCase()
	b = b.toLowerCase()
	// increment along the first column of each row
	var i
	for(i = 0; i <= b.length; i++){
		matrix[i] = [i]
	}
	// increment each column in the first row
	var j
	for(j = 0; j <= a.length; j++){
		matrix[0][j] = j
	}
	// Fill in the rest of the matrix
	for(i = 1; i <= b.length; i++){
		for(j = 1; j <= a.length; j++){
			if(b.charAt(i-1) == a.charAt(j-1)){
				matrix[i][j] = matrix[i-1][j-1]
			} else {
				matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
								Math.min(matrix[i][j-1] + 1, // insertion
								matrix[i-1][j] + 1)); // deletion
			}
		}
	}
	return matrix[b.length][a.length]
}


/**
 * @param  {object} DOM element
 * @description get all possible attributes from the element
 */
export const getAllAttributes = function(element) {
	return new Promise((resolve, reject) => {

		try {
			getOffset(element)
			.then(offsets => {
				// get all possible attributes from node
				const attributes = {}
				for (var att, i = 0, atts = element.attributes, n = atts.length; i < n; i++) {
					att = atts[i]
					attributes[att.nodeName] = att.nodeValue
				}
		
				// get the ways to find the element from 
				const element_props = locatorBuilders.buildAll(element)
		
				// main send object
				const props = {
					height: offsets.height,
					width: offsets.width,
					clientX: offsets.left,
					clientY: offsets.top,
					element_props,
					attributes,
					type: element.nodeName.toLowerCase(),
					text: element.innerText,
					x_scroll: window.pageXOffset,
					y_scroll: window.pageYOffset,
					browser_height: window.innerWidth,
					browser_width: window.innerHeight
				}
		
				// url data
				const paramsObj = new URLSearchParams(window.location.search)
				const query_parameters = {}
				for (let value of paramsObj.keys()) {
					query_parameters[value] = paramsObj.get(value)
				}
				props.url = window.location.href
				props.domain = window.location.hostname
				props.protocol = window.location.protocol
				props.path = window.location.pathname
				props.query_parameters = query_parameters

				resolve(props)

			})
			.catch(err => {
				_error("Error in getOffset promise chain")
				console.error(err)
				reject(err)
			})
		} catch (error) {
			_error("Error in getAllAttributes method")
			console.error(error)
			reject(error)
		}
	})
}


/**
 * @param {object} element - `element object`
 * @returns {object} location values
 * @description get the boundaries of the element
 */
const getOffset = function(el) {
	return new Promise((resolve, reject) => {
		const rect = el.getBoundingClientRect()
		
		resolve({
			left: rect.left,
			top: rect.top,
			leftCenter: rect.left + (rect.width / 2),
			topCenter: rect.top + (rect.height / 2),
			width: rect.width,
			height: rect.height
		})
	})
}


/**
 * executes the mouse event
 * @param {object} node 
 * @param {string} eventType 
 */
const triggerMouseEvent = function(node, eventType) {
    const clickEvent = document.createEvent('MouseEvents')
    clickEvent.initEvent(eventType, true, true)
    node.dispatchEvent(clickEvent)
}


/**
 * @param  {element_object} element
 * @param  {object} element_data - contains the teststep information
 * @returns {string} - `successful` or `failed`
 */
export const performEvent = function(element, value, type) {
	return new Promise((resolve, reject) => {
		try {
			// perform the action
			let event_performed = false
			if (element.nodeName.toLowerCase() === "select") {
				element.focus()
				element.value = value
				event_performed = true
			} else if (type === "text_input") {
				element.click()
				element.focus()
				element.value = value
				element.dispatchEvent(new Event("input"))
				event_performed = true				
			} else if (type === "mouselclick") {
				triggerMouseEvent(element, "mouseover")
				triggerMouseEvent(element, "mousedown")
				triggerMouseEvent(element, "mouseup")
				triggerMouseEvent(element, "click")
				event_performed = true
			}

			event_performed ? resolve("successful") : resolve("failed")
		} catch (error) {
			_error("Error in performEvent method")
			console.error(error)
			reject(error)
		}
	})
}


/**
 * @description scroll the page with viewport height. Return the "not found" string for end of the page.
 */
export const manageScroll = async function() {
	const viewport = window.pageYOffset + window.innerHeight
	const body = document.body
    const html = document.documentElement
	const documentMax = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight)

	console.log(`Y Offset: ${window.pageYOffset} - Viewport: ${viewport} - Document Max Height: ${documentMax}`)

	// if - page end is not there then scroll the page and re-run the detection
	// else - send msg that the element is not found

	if (viewport < documentMax) {
		window.scrollTo(0, viewport)
		return "scrolled"
	} else {
		return "not_found"
	}
}
