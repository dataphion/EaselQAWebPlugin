
## Usage
1. `yarn` or `npm install`
2. `yarn start` or `npm start`
3. Go to [chrome extensions page](chrome://extensions/)
4. Click on **Load unpacked**
5. Browse the **build** folder of the project


## Important Notes
The localstorage can hold up to max 5MB data


## Identifiers
> From popup to background script

* **START**: Start the recording session
* **STOP**: Stop the recording session
* **ANCHOR**: Record the anchor element
* **PLAY_TEST**: Play the selected session

---

> Playback.js

* **PING**: To know if the page is ready to accept the event data
* **PLAY_TESTCASE**: Run the received step
* **TRY_AGAIN_TO_FIND_ELEMENT**: Scan the viewport again for the element
* **DETECTED_POSITION**: Try with the coordinates provided by vision api
* **SCROLL**: Scroll the page and scan the viewport again for the element

---

* **PERFORM_PING**: Perform Event data
* **RECHECK**: Try with the vision response (same as DETECTED_POSITION)
* **PERFORM_TESTCASE**:  Same as DETECTED_POSITION, but for the *perform* usage

---

> From content script to background script

* **SCROLLING_DONE**: Scrolling action is performed
* **NOTIFICATION**: Display the notification
* **RECHECK**: Recheck the current page
* **NEXT_LINE**: Learning phase - The required action was performed - Serve the next step
* **RECORD_UPDATE**: Record phase - Save the performed action

---
> From background script to content script

* **PING**: To know that the content script is properly loaded and ready to get the action details
* **SCROLL_DELAY**: Don't perform any action and wait for some time (2.5s)
* **SCROLL**: Scroll the page by viewport height and if the offeset is !=0 for the new page then scroll to top
* **LEARN_TESTCASE**: Learning phase - Get all possible attributes for the element and perform the action
