import constant from '../helpers/constant'
import { _error, _info, _warning } from '../background/helperFunctions'
import _ from 'lodash'
import { sendMessage, getTarget, getElement, performEvent, sendPropsUpdate, sendUpdate } from './helperFunctions'
import { collectProps, getOffset, mergeIds} from '../helpers/propsHelpers'
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async/dynamic')





let FINDING_ALIVE = false





/**
 * @param {Object} element_data - `element object`
 * @returns `void` - nothing
 * @description main playback event
 */
const handlePlayback = async function(element_data) {
	const event = element_data.event
	let element = null

	// get the element from the primary element first
	const find_target = await getTarget(element_data["data"]["step_data"])

	// if the element is still not found, then try finding it with the other ways possible
	if (find_target === "element_not_found") {
		const alternate_finding_resp = await getElement(element_data["data"]["step_data"])
		if (alternate_finding_resp === "element_not_found") {
			// probably call the vision api
		} else {
			element = alternate_finding_resp
		}
	} else {
		element = find_target
	}

	_info("Found element is")
	console.log(element)

	// if the element is present, then proceed further
	if (element) {

		// wait until there are no overlays
		const overlayState = await checkOverlayNotPresent(element)
		if (overlayState === "redo") {
			handlePlayback(element_data)
		} else {
			const props = await collectProps(null, event, element)
			const updated_props = await mergeIds(element_data, props)
			await performEvent(element, element_data.data.step_data)
	
			sendPropsUpdate(element, event, updated_props, element_data)
			sendUpdate(event)
			FINDING_ALIVE = false
			return
		}


	}

}


/**
 * @param {Object} element - `element object`
 * @returns {String} redo | success
 * @description element is found, but make sure there are no overlays on top of it
 */
const checkOverlayNotPresent = async(element) => {
	return new Promise((resolve, reject) => {

		// check every 100 ms
		const timer = setIntervalAsync(async () => {

			// check if the element is present at the negative space
			// this can happen when website uses multiple overlying buttons
			let negativeValue = await checkNegativeElement(element)

			// verify that the element is clickable
			let coords = getOffset(element)
			let {leftCenter, topCenter} = coords
			if (leftCenter === 0 && topCenter === 0) {
				_info("redo")
				resolve("redo")
				await clearIntervalAsync(timer)
			}
			console.log(`picking from points - ${topCenter}, ${leftCenter}`)
			
			let pointedElement = document.elementFromPoint(leftCenter, topCenter)
			// console.log("\nelement")
			// console.log(element)
			// console.log("pointedElement")
			// console.log(pointedElement)
			// console.log("\n")
			

			if (pointedElement === null){
				//condition for scroll to elements position..
				const viewport = window.pageYOffset + window.innerHeight
				
				console.log("pointed element is null, requires scrolling")
				console.log(`offset: ${window.pageYOffset} <= coords.top: ${window.pageYOffset + coords.y} && ${window.pageYOffset + coords.y} <= viewport: ${viewport}`)
				
				if (!(window.pageYOffset <= (window.pageYOffset + coords.y) && window.pageYOffset + coords.y <= viewport)) {
					window.scrollTo(0, window.pageYOffset + coords.y)
					_warning("Scolled to position: ", window.pageYOffset + coords.y)
				}
			}


			// verify that there are no possible overlays on the element
			// verify if the original node and new node are same
			// POintendElement is null when it is outside of viewPort.

			if (pointedElement === null && negativeValue){
				_warning("Pointed element and detected elements are same - 1")
				resolve("success")
				await clearIntervalAsync(timer)
			}
			
			if (pointedElement !== null) {
				if (element.isEqualNode(pointedElement)) {
					_warning("Pointed element and detected elements are same - 2")
					if (element.nodeName.toLowerCase() === "input") {
						if (!element.disabled) {
							resolve("success")
							await clearIntervalAsync(timer)
						}
					} else {
						resolve("success")
						await clearIntervalAsync(timer)
					}
				}
				if (pointedElement.parentNode) {
					if (pointedElement.parentNode.nodeName.toLowerCase() === "button") {
						_warning("Pointed element and detected elements are same - 3")
						resolve("success")
						await clearIntervalAsync(timer)
					}
				}
			}
			
		}, 100)
	})
}


/**
 * @param {Object} element - `element object`
 * @returns {Boolean} true | false
 * @description check if the element is present in the negative space
 */
const checkNegativeElement = element => {
	return new Promise((resolve, reject) => {
		let negativeValue = false
		let coords = getOffset(element)
		let {leftCenter, topCenter} = coords

		// scroll to the top if either of the values are negative
		if (leftCenter < 0 || topCenter < 0) {
			window.scrollTo(0,0)
		}

		// again get the element and make sure that there are
		// no negative values
		coords = getOffset(element)
		leftCenter = coords.leftCenter
		topCenter = coords.topCenter

		if (leftCenter < 0 || topCenter < 0) {
			negativeValue = true
		}

		resolve(negativeValue)

	})
}









/* on hash change ask the background script for the current step data
window.addEventListener('hashchange', () => {
	setTimeout(() => {
		_error("sending hash change")
		sendMessage({
			type: "PLAYBACK_PAGE_READY"
		})
	}, 3000)
})
*/



// on load ask the background script for the current step data
window.onload = () => {
	FINDING_ALIVE = false
	console.log("Done Loading");
	
	sendMessage({
		type: "PLAYBACK_PAGE_READY"
	})
}


// receive the message from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	_info("\n- PLAYBACK - Received Message from Background -")
	console.log(message)

	// let background js know that the page is ready to take an action
	if (message.action === "PING") {

		// if the page is in ready state, then only send the pong
		if (document.readyState === "complete") {
			sendResponse({ message: "PONG" })
		}

	} else if (message.action === "PLAY_TESTCASE") {

		// for the first time only
		// scroll page to saved position
		if (message.testcaseData.data.step_data.x_scroll > 0)
			window.scrollTo(message.testcaseData.data.step_data.x_scroll, 0)
		if (message.testcaseData.data.step_data.y_scroll > 0)
			window.scrollTo(0, message.testcaseData.data.step_data.y_scroll)

		if (!FINDING_ALIVE) {
			handlePlayback(message.testcaseData)
			FINDING_ALIVE = true
		}
	}

})