import _ from 'lodash'
import { _error, _info, _warning } from '../background/helperFunctions'
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async/dynamic')
import constant from '../helpers/constant'
import { getOffset} from '../helpers/propsHelpers'



export const sendMessage = function(msg) {
	try {
		if (chrome.runtime && chrome.runtime.onMessage) {
			chrome.runtime.sendMessage(msg)
		}
	} catch (err) {
		_error("Unable to send the message to background script")
		console.error(error)
	}
}



export const getTarget = async function(element_data) {
	/**
	 * PRIORITIES:
	 * 1. id
	 * 2. name
	 * 3. classad name
	 * 4. xpaths
	 * 5. X-Y position
	 */

	 try {
		 const primary_data = getPrimaryAttribute(element_data)
		 console.log(primary_data)
		 console.log(`primary_attribute is ${primary_data.type}`)
		 if (primary_data.type === "no_primary_attributes") {
			return "try_other_attributes"
		 } else {
			const elt = await findElement(primary_data, element_data)
			return elt
			// return "element_not_found"
		 }
		 
	 } catch (error) {
		_error("Error in findElement")
		console.error(error)
	 }
}



const findElement = async(element_data, original_data) => {
	_error("CALLED FIND ELEMENT")
	return new Promise((resolve, reject) => {
		// let max_tries = 1800 // 3 minutes
		let max_tries = 360 // 3 minutes
		let receivedFlag = false
		let element = {}

		const timer = setIntervalAsync(async () => {
			// console.log(`max try value for ${max_tries}`);
			console.debug("finding element")

			if (max_tries === 0) {
				console.debug("returning element from findElement - cause the max tries are over")
				resolve("element_not_found")
				await clearIntervalAsync(timer)
			}
			
			if (receivedFlag) {
				console.debug("returning element from findElement - cause got the element")
				resolve(element)
				await clearIntervalAsync(timer)
			} else {
				if (element_data.type === "id") {
					let result = document.querySelector(element_data.val)
					if (result !== null) {
						element = result
						receivedFlag = true	
					}
				} else if (element_data.type === "class") {
					let result = document.querySelectorAll(element_data.val)
					if (result.length > 0) {
						const elt = await findBestMatchedElement(result, original_data)
						if (elt !== null) {
							element = elt
							receivedFlag = true	
						}
					}
				} else if (element_data.type === "name") {
					let result = document.querySelectorAll(element_data.val)
					if (result.length > 0) {
						const elt = await findBestMatchedElement(result, original_data)
						if (elt !== null) {
							element = elt
							receivedFlag = true	
						}
					}
				} else if (element_data.type === "xpath") {
					let result = document.evaluate(element_data.val, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
					if (result !== null) {
						element = result
						receivedFlag = true	
					}
				}
			}
			max_tries-=1
		}, 500)
	})
}


export const getPrimaryAttribute = function(element_data) {
	let return_obj = {}

	if (element_data.element_id) {
		return_obj["type"] = "id"
		return_obj["val"] = `#${element_data.element_id}`
		return_obj["selector"] = `id=${element_data.element_id}`
	} else if(element_data.element_attributes.name) {
		return_obj["type"] = "name"
		return_obj["val"] = `[name="${element_data.element_attributes.name}"]`
		return_obj["selector"] = `name=${element_data.element_attributes.name}`
	} else if(element_data.element_css) {
		return_obj["type"] = "class"
		if (element_data.element_css.split(" ").length > 1) {
			let classes = ""
			element_data.element_css.split(" ").map(classname => {
				classes = classes + `.${classname}`
			})
			return_obj["val"] = `${classes}`
			return_obj["selector"] = `class=${classes}`
		} else {
			return_obj["val"] = `[class="${element_data.element_css}"]`
			return_obj["selector"] = `class=${element_data.element_css}`
		}
	} else if(element_data.element_xpaths) {
		if (element_data.element_xpaths[0]) {
			return_obj["type"] = "xpath"
			return_obj["val"] = element_data.element_xpaths[0]
			return_obj["selector"] = element_data.element_xpaths[0]
		}
	}
	return return_obj
}



export const findBestMatchedElement = async function(elements, existing_data) {

	const existing_attributes = existing_data.element_attributes

	_error("existing_attributes")
	console.log(existing_attributes)
	_error("elements")
	console.log(elements)
	
	try {
		let elementStack = []
		for (const element of elements) {

			let coords = getOffset(element)
			let {leftCenter, topCenter} = coords

			// if not undefined and the element is visible (having height-width)
			if (element && leftCenter !== 0 && topCenter !== 0) {

				// get all possible attributes from node
				const current_attributes = {}
				for (let att, i = 0, atts = element.attributes, n = atts.length; i < n; i++) {
					att = atts[i]
					current_attributes[att.nodeName] = att.nodeValue
				}

				// get the common, different attributes and confidence
				const elements_obj = [existing_attributes, current_attributes]
				const result = commonDifferentProperties(elements_obj)
				
				elementStack.push({
					text: element.innerText,
					element,
					common: result.common,
					different: result.different,
					confidence: result.confidence
				})
			}
		}

		if (elementStack.length > 0) {

			// return the element if the innerText matches
			for (const elt of elementStack) {
				if (elt.text.toLowerCase().trim().length > 0 && existing_data.text.toLowerCase().trim().length > 0) {
					// console.log(`${elt.text.toLowerCase().trim()} - ${existing_data.text.toLowerCase().trim()}`)
					if (elt.text.toLowerCase().trim() === existing_data.text.toLowerCase().trim()) {
						// console.log("matched and returned")
						return elt.element
					}
				}
			}

			// PERFORM BELOW STEPS ONLY
			// IF ELEMENT IS NOT MATCHED WITH INNERTEXT
		
			// sort the stack based on confidence key value
			const sortedElementStack = _.orderBy(elementStack, ['confidence'],['desc'])

			_error("sortedElementStack")
			console.log(sortedElementStack)
			
			// if the confidence is higher than matching_threshold,
			// then pick and return that element
			if (sortedElementStack[0]["confidence"] > constant.matching_threshold) {
				return sortedElementStack[0]["element"]
			} else {
				return "element_not_found"
			}

		} else {
			return "element_not_found"
		}

	} catch (error) {
		_error("Error in findBestMatchedElement method")
		console.error(error)
	}
}


const commonDifferentProperties = function(objects) {
	try {
		// find common attributes
		const common = _.reduce(objects, (acc, obj) => {
			for (let p in obj)
				acc[p] = obj[p]
			return acc
		}, {})
		
		// get different attributes
		const different = _.reduce(objects, (acc, obj) => {
			for (let p in common)
				if (common[p] !== obj[p]) {
					delete common[p]
					acc.push(p)
				}
			return acc
		}, [])
		
		return {
			common: common,
			different: different,
			confidence: Object.keys(common).length / (Object.keys(common).length + different.length)
		}
	} catch (error) {
		_error("Error in commonDifferentProperties method")
		console.error(error)
	}
}


export const getElement = async function(element_data) {

	/**
	 * PRIORITIES:
	 * 1. id
	 * 2. name
	 * 3. class name
	 * 4. xpaths
	 * 5. X-Y position
	 */
	try {
		let identified_element = {}
		let identified = false
		// try with id
		if (!identified && element_data.element_id) {
			if (element_data.element_id.trim() !== "") {
				_info("id")
				const element = document.getElementById(element_data.element_id)
				if (element !== null) {
					if (element.attributes.length > 0) {
						identified = true
						identified_element = element
						console.log(element)
						_warning("Element found with id")
						return element
					}
				}
			}
		}
		
		// try with name
		if (!identified && element_data.element_attributes.name) {
			if (element_data.element_attributes.name.trim() !== "") {
				const possible_elements = document.getElementsByName(element_data.element_attributes.name)
				_info("name")
				console.log(element_data.element_attributes.name)
				
				if (possible_elements.length > 0) {
					const element = await findBestMatchedElement(possible_elements, element_data)
					console.log("element response");
					console.log(element);
					
					if (element !== "element_not_found") {
						if (element.attributes.length > 0) {
							identified = true
							identified_element = element
							console.log(element)
							_warning("Element found with name")
							return element
						}
					}
				}
			}
		}

		// try with class
		if (!identified && element_data.element_css) {
			if (element_data.element_css.trim() !== "") {
				_info("class")
				const possible_elements = document.getElementsByClassName(element_data.element_css)
				if (possible_elements.length > 0) {
					const element = await findBestMatchedElement(possible_elements, element_data)
					if (element !== "element_not_found") {
						if (element.attributes.length > 0) {
							identified = true
							identified_element = element
							console.log(element)
							_warning("Element found with css/class")
							return element
						}
					}
				}
			}
		}

		// try with xpaths
		if (!identified && element_data.element_xpaths) {
			if (element_data.element_xpaths.length > 0) {
				for (const xpath of element_data.element_xpaths) {
					_info(`xpath: ${xpath}`)
					
					try {
						const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
						const element = result.singleNodeValue
						if (element !== null) {
	
							if (element.attributes.length > 0) {
								identified = true
								identified_element = element
								console.log(element)
								_warning(`Element found with xpath ${xpath}`)
								return element
							} else if (
								(element.attributes.length === 0 && Object.keys(element_data.element_attributes).length === 0)
								&&
								(element.nodeName.toLowerCase() === element_data.element_type)
								) {
								identified = true
								identified_element = element
								console.log(element)
								_warning(`Element found with xpath ${xpath} - without any attributes`)
								return element
							}
						}
					} catch (error) {
						_error(`XPATH ${xpath} Evaluation failed..`)
					}

				}
			}
		}
		

		// try with x-y position
		if (!identified) {
			_info("xy")
			const possible_elements = []
			const x = (element_data.x_cord * window.devicePixelRatio) + (element_data.width / 2)
			const y = (element_data.y_cord * window.devicePixelRatio) + (element_data.height / 2)
			possible_elements.push(document.elementFromPoint(x, y))
			const element = await findBestMatchedElement(possible_elements, element_data)
			if (element !== "element_not_found") {
				if (element.attributes) {
					if (element.attributes.length > 0) {
						identified = true
						identified_element = element
						console.log(element)
						_warning(`Element found from points ${element_data.x_cord + (element_data.width / 2)} - ${element_data.y_cord + (element_data.height / 2)}`)
						return element
					} else if (
						(element.attributes.length === 0 && Object.keys(element_data.element_attributes).length === 0)
						&&
						(element.nodeName.toLowerCase() === element_data.element_type)
						) {
						identified = true
						identified_element = element
						console.log(element)
						_warning(`Element found from points ${element_data.x_cord + (element_data.width / 2)} - ${element_data.y_cord + (element_data.height / 2)} - without any attributes`)
						return element
					}
				}
			}
		}

		// match with all possible attributes
		if (!identified && element_data.element_attributes) {
			const attibutes = Object.keys(element_data.element_attributes)
			if (attibutes.length > 0) {
				_info("custom attribute")
				for (const attribute of attibutes) {
					if (!identified && !["class", "id", "name"].includes(attribute)) {
						try {
							const possible_elements = document.querySelectorAll(`[${attribute}=${element_data.element_attributes[attribute]}]`)
							if (possible_elements.length > 0) {
								const element = await findBestMatchedElement(possible_elements, element_data)
								if (element !== "element_not_found") {
									if (element.attributes.length > 0) {
										identified = true
										identified_element = element
										console.log(element)
										_warning("Element found with custom attribute")
										return element
									}
								}
							}
						} catch (error) {
							_error("Error in finding the element with custom attribute for attribute: ", attribute)
							console.error(error)
						}
					}
				}
			}
		}
		

		if (identified) {
			return identified_element
		} else {
			_warning("element not found")
			return "element_not_found"
		}
	} catch (error) {
		_error("Error in getElement method")
		console.error(error)
		return error
	}
}



const triggerMouseEvent = function(node, eventType) {
    const clickEvent = document.createEvent('MouseEvents')
    clickEvent.initEvent(eventType, true, false)
    node.dispatchEvent(clickEvent)
}


export const performEvent = function(element, element_data) {
	return new Promise((resolve, reject) => {
		try {
			
			// max tries to verify the updated value
			let tries_counter = constant.value_verification_max_tries

			if (element_data.action === "dropdown") {
				_warning("performing dropdown")
				element.focus()
				element.value = element_data.element_value
				const event = new Event("change")
				element.dispatchEvent(event)

				// verify the updated value
				let changeFlag = false
				let sendOnInterval = setInterval(() => {
					if (changeFlag) {
						resolve("successful")
						clearInterval(sendOnInterval)
					} else if (tries_counter === 0) {
						resolve("failed")
						clearInterval(sendOnInterval)
					} else {
						element.focus()
						element.value = element_data.element_value
						const event = new Event("change")
						element.dispatchEvent(event)
						changeFlag = (element.value === element_data.element_value) ? true : false
					}
					tries_counter--
				}, 500)

			} else if (element_data.action === "text_input") {
				_warning("performing text input")


				/* new code start

				// let keys = new String(element_data.element_value).split("")
				let keys = new String("hellue").split("")
				for (let i = 0; i < keys.length; i++) {
					let keyz = keys[i]
					triggerKeyEvent(element, keyz)
				}

				// new code end */


				// old code start

				element.click()
				element.focus()
				element.value = element_data.element_value
				element.dispatchEvent(new Event("input"))

				// verify the updated value
				let changeFlag = false
				let sendOnInterval = setInterval(() => {
					if (changeFlag) {
						resolve("successful")
						clearInterval(sendOnInterval)
					} else if (tries_counter === 0) {
						resolve("failed")
						clearInterval(sendOnInterval)
					} else {
						changeFlag = (element.value === element_data.element_value) ? true : false
					}
					tries_counter--
				}, 500)

				// old code end */

			} else if (element_data.action === "mouselclick") {
				_warning("performing mouseclick")
				triggerMouseEvent(element, "mouseover")
				triggerMouseEvent(element, "mousedown")
				// triggerMouseEvent(element, "click")
				element.click()
				triggerMouseEvent(element, "mouseup")
				resolve("successful")
			}

			// event_performed ? resolve("successful") : resolve("failed")
		} catch (error) {
			_error("Error in performEvent method")
			console.error(error)
			reject(error)
		}
	})
}


export const sendPropsUpdate = function (elt, type, props, old_data) {
	
	// prepare data to send
	if (type === "text_input") {
		sendMessage({
			type: "RECORD_UPDATE",
			action: "text_input",
			value: elt.value,
			old_data,
			props
		})
	} else if(type === "dropdown") {
		sendMessage({
			type: "RECORD_UPDATE",
			action: "dropdown",
			value: elt.value,
			old_data,
			props
		})
	} else {
		if (type.includes("mouse")) {
			const sendObj = {
				type: "RECORD_UPDATE",
				action: type.toLowerCase(),
				old_data,
				props
			}
			// if the element has value, then add it
			if (["radio", "checkbox"].includes(elt.nodeName.toLowerCase())) {
				sendObj["value"] = elt.value ? elt.value : ""
			}
			sendMessage(sendObj)
		}
	}
}


export const sendUpdate = function (action) {
	sendMessage({
		type: "NOTIFICATION",
		message: `${action} action performed`
	})
	_error("\nREQUESTING NEXT PLAYBACK\n")
	sendMessage({
		type: "NEXT_PLAYBACK"
	})
}


const triggerKeyEvent = function (element, keySequence) {
	let keycode = keySequence.toUpperCase().charCodeAt(0)

	_info(`for ${keySequence}, the keycode is ${keycode}`)
	
	let k_down_evt = new KeyboardEvent("keydown", {
		bubbles: true,
		cancelable: true,
		view: window,
		key: keySequence,
		isTrusted: true,
		code: `Key${keySequence.toUpperCase()}`,
		location: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		metaKey: false,
		repeat: false,
		isComposing: false,
		charCode: keycode,
		keyCode: keycode,
		which: keycode
	})

	let k_press_evt = new KeyboardEvent("keypress", {
		bubbles: true,
		cancelable: true,
		view: window,
		key: keySequence,
		code: `Key${keySequence.toUpperCase()}`,
		location: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		metaKey: false,
		repeat: false,
		isComposing: false,
		charCode: keycode,
		keyCode: keycode,
		which: keycode
	})
	
	let i_input_evt = new InputEvent("input", {
		bubbles: true,
		cancelable: true,
		view: window,
		data: keySequence
	})

	let k_up_evt = new KeyboardEvent("keyup", {
		bubbles: true,
		cancelable: true,
		key: keySequence,
		view: window,
		code: `Key${keySequence.toUpperCase()}`,
		location: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		metaKey: false,
		repeat: false,
		isComposing: false,
		charCode: keycode,
		keyCode: keycode,
		which: keycode
	})

	console.log("\n-----------------")
	console.log(k_down_evt)
	console.log(k_press_evt)
	console.log(i_input_evt)
	console.log(k_up_evt)
	

	element.dispatchEvent(k_down_evt)
	element.dispatchEvent(k_press_evt)
	element.dispatchEvent(i_input_evt)
	element.dispatchEvent(k_up_evt)
}
