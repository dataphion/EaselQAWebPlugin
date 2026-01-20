import { _error, _info, _warning } from '../background/helperFunctions'
import { getBestMatchingString, getAllAttributes, performEvent, manageScroll, getBestMatchingInputText } from './helpingFunctions'


// store the last step data to use it in rechecking the page
let CURRENT_TESTSTEP_DATA = {}


/**
 * @param {any} msg - any message type
 * @returns {void} - nothing
 * @description sends message from content script to background script
 */
const sendMessage = function(msg) {
	try {
		if (chrome.runtime && chrome.runtime.onMessage) {
			chrome.runtime.sendMessage(msg)
		}
	} catch (err) {
		_error("Unable to send the message to background script")
		console.error(err)
	}
}


/**
 * @param  {string} action - type of performed event Eg. `drag_drop`
 * @description  send `NOTIFICATION` and `NEXT_PLAYBACK` events to background script
 * @returns {void} - nothing
 */
const sendUpdate = function(action) {
	return new Promise((resolve, reject) => {
		sendMessage({
			type: "NOTIFICATION",
			message: `${action} action performed`
		})
		sendMessage({
			type: "NEXT_PERFORM"
		})
		resolve("done")
	})
}


/**
 * @param  {object} message - message from background script
 * @param  {object} sender - the sender information
 * @param  {callback} sendResponse - if any message acknowledgemenet  - message/string
 * @returns {void} nothing
 * @description get a action message from background js and perform
 */
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
// 	_info("- PERFORM - Received Message from Background -")
// 	console.log(message)

// 	// let background js know that the page is ready to take an action
// 	if (message.action === "PERFORM_PING") {

// 		if (document.readyState === "complete") {
// 			sendResponse({ message: "PERFORM_PONG" })
// 		}

// 	} else if (message.action === "RECHECK") {

// 		// manageScroll()
// 		// .then(scroll_done => {
			
// 		// 	if (scroll_done === "scrolled") {
// 		const {testcaseData} = CURRENT_TESTSTEP_DATA
// 		manager(testcaseData, message.visionResponse)
// 		// 	} else {
// 		// 		sendMessage({
// 		// 			type: "ELEMENT_NOT_FOUND"
// 		// 		})
// 		// 	}
// 		// })

// 	} else if (message.action === "PERFORM_TESTCASE") {

// 		CURRENT_TESTSTEP_DATA = message
// 		const {testcaseData, visionResponse} = message
// 		manager(testcaseData, visionResponse)

// 	}

// })

/**
 * @param  {object} testcaseData
 * @param  {Array} visionResponse
 * @description get the testcase data and vision response to perform the required event on required element
 */
export const manager = function(testcaseData, visionResponse) {
	
	const {intent, entities, text} = testcaseData

	if (intent === "SENDKEY") {

		const key_element = entities[1]
		const text_coords = getBestMatchingString(key_element, visionResponse)
		console.log(text_coords);
		
		if (text_coords) {
			// Get All text box and it's co-ordinates. 
			// Get the nearest text box..
			let coords = getBestMatchingInputText(text_coords);
			const x = (coords[0] + coords[2]) / 2
			const y = (coords[1] + coords[3]) / 2
			getAttributesAndPerformEvent(testcaseData, {x,y})
		} else {
			// for the safe side, wait for 3 seconds before rechecking the page
			setTimeout(() => {
				sendMessage({type: "SCROLL_PERFORM"})
			}, 3000)
		}
		
	} else if(intent === "CLICK") {
		
		const key_element = entities[0]
		const coords = getBestMatchingString(key_element, visionResponse)
		
		if (coords) {
			const x = (coords[0] + coords[2]) / 2
			const y = (coords[1] + coords[3]) / 2
			getAttributesAndPerformEvent(testcaseData, {x,y})
		} else {
			// for the safe side, wait for 3 seconds before rechecking the page
			setTimeout(() => {
				sendMessage({type: "SCROLL_PERFORM"})
			}, 3000)
		}
	}
	
}


/**
 * @param  {object} testcaseData
 * @param  {} coordinates
 * @description get the metadata and perform the event on the identified element
 */
const getAttributesAndPerformEvent = async function(testcaseData, coordinates) {

	try {
		const {intent, entities} = testcaseData
		const {x, y} = coordinates
		const value = entities[0]
		
		const element = document.elementFromPoint(x, y)
		_info("Element is: ")
		console.log(element)
		
		const attributes = await getAllAttributes(element)
		
		// save, perform and send the notification to background script

		if (["SENDKEY"].includes(intent)) {
			await saveTestDetails(attributes, value, "text_input")
			await performEvent(element, value, "text_input")
			await sendUpdate("text")
		} else if(["CLICK"].includes(intent)) {
			await saveTestDetails(attributes, value, "mouselclick")
			await performEvent(element, value, "mouselclick")
			await sendUpdate("mouse click")
		}

	} catch (error) {
		console.log("Error in getAttributesAndPerformEvent")
		console.log(error)
	}

}



/**
 * @param  {object} props
 * @param  {any} value
 * @param  {string} action
 * @description send the gathered data to background script to save
 */
const saveTestDetails = function(props, value, action) {
	return new Promise((resolve, reject) => {
		sendMessage({
			type: "PERFORM_RECORD_POST",
			action,
			value,
			props
		})
		resolve("success")
	})
}
