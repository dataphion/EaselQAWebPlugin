import "../../img/ext-icon.png";
import "../../img/ext-icon.png";
import "../../img/logo.png";
import "../../img/new-tab.png";
import _ from "lodash";

// configuration
import constant from "../helpers/constant";
import { giveUrl } from "../helpers/geturls";

// functions
import { openPerformWindow, playbackPerformScript, playbackContentScript, openPlaybackWindow, openRecordingWindow, closeRecordingWindow } from "./tabFunctions";
import { getPerformStepData, makeDescription, takeScreenshot, getPlaybackStepData, notify, _info, _error, _warning } from "./helperFunctions";
import { processPlaybackRun, processPost, procesPostframe, processUpdate } from "./processing";

let RECORDING_SESSION_INDEX = 1;
let PREVIOUS_OBJ = null;
let currentRecordingFrameLocation = "";

// get message from browser..
if (chrome.runtime.onMessageExternal) {
  if (!chrome.runtime.lastError) {
    chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
      console.log("request from portal");
      console.log(request);

      /**
       * SUPPORTED:
       *
       * 1. test case playback
       * 2. insertion of nodes in the middle
       * 3. test case recording
       */

      if (request.type === "playback") {
        chrome.storage.local.set({ middleInsertion: 0, playback_add_steps_at: 0 }, () => {
          processPlaybackRun(request.id);
          sendResponse({
            status: "successful"
          });
        });
      } else if (request.type === "insert_middle") {
        chrome.storage.local.set({ middleInsertion: 0, playback_add_steps_at: request.step }, () => {
          processPlaybackRun(request.id);
          sendResponse({
            status: "successful"
          });
        });
      } else if (request.type === "record") {
        openRecordingWindow(request.name, request.description, request.url, request.app_id, request.feature_id).then(testcase_id => {
          _error("setting to 1");
          RECORDING_SESSION_INDEX = 1;
          // _error("setting to 0")
          // chrome.storage.local.set({
          // 	middleInsertion: 0,
          // 	playback_add_steps_at: 0,
          // 	recording_session_index: 1,
          // 	current_action: "record_in_execution"
          // })
          _warning(`sending ... ${testcase_id}`);
          sendResponse({
            status: "success",
            testcase_id
          });
        });
      }

      // // perform scenario
      // if (request.session_id) {
      // 	openPerformWindow(request.session_id)
      // }
    });
  }
}

/**
 * TYPES:
 *
 * START - record a new test
 * STOP - stop the currently recording test and close the recording window
 * ANCHOR - to record the anchor element
 * PLAY_TEST - play the selected recorded test
 *
 */

// get the message from popup
chrome.extension.onConnect.addListener(async port => {
  port.onMessage.addListener(async msg => {
    _info("received message from popup");
    console.log(msg);

    if (msg.type === "START") {
      // if  : the new feature is provided then first insert it and then use it
      // else: the feature is already present, then directly use it
      RECORDING_SESSION_INDEX = 1;
      if (msg.newFeature) {
        // api call
        let strapi_url = await giveUrl("strapi_url");
        console.log("get graphql url", strapi_url);
        // fetch(`${constant.strapi_url}/features`, {
        fetch(`${strapi_url}/features`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: msg.record_feature })
        })
          .then(res => res.json())
          .then(res => {
            console.log("background ---> ", res);

            openRecordingWindow(msg.record_name, msg.record_description, msg.record_url, msg.record_application, res.id);
            // chrome.storage.local.set({ middleInsertion: 0, recording_session_index: 1, playback_add_steps_at: 0 })
            port.postMessage("opened a new window-tab for recording");
          })
          .catch(err => {
            _error("error in post api call");
            console.log(err);
          });
      } else {
        openRecordingWindow(msg.record_name, msg.record_description, msg.record_url, msg.record_application, msg.record_feature);
        // chrome.storage.local.set({ middleInsertion: 0, recording_session_index: 1 })
        port.postMessage("opened a new window-tab for recording");
      }
      currentRecordingFrameLocation = "root";
    } else if (msg.type === "ANCHOR") {
      chrome.storage.local.get("recording_tab_id", items => {
        chrome.tabs.sendMessage(items.recording_tab_id, {
          action: "RECORD_ANCHOR"
        });
      });
    } else if (msg.type === "GRID") {
      chrome.storage.local.get("recording_tab_id", items => {
        chrome.tabs.sendMessage(items.recording_tab_id, {
          action: "RECORD_GRID",
          testcase_id: items.recording_tab_id,
          step: RECORDING_SESSION_INDEX
        });
      });
    } else if (msg.type === "STOP") {
      setTimeout(() => {
        closeRecordingWindow().then(() => {
          // reset the values
          RECORDING_SESSION_INDEX = 1;
          // chrome.storage.local.set({ middleInsertion: 0, recording_session_index: 1, playback_add_steps_at: 0 })
          port.postMessage("closed the recording tab");
        });
      }, 100);
    } else if (msg.type === "PLAY_TEST") {
      // run the testcase in a new tab and update the metadata

      chrome.storage.local.set({ middleInsertion: 0, layback_add_steps_at: 0 }, () => {
        processPlaybackRun(msg.data); // msg.data is the testsession 'id'
      });
    }
  });
});

// get the message from content scripts

/**
 * TYPES:
 *
 ** COMMON FOR ALL SCRIPTS
 * NOTIFICATION
 *
 ** RECORDING SCRIPT
 * RECORD_PING -> sends START_RECORDING
 * RECORD_POST
 *
 ** PLAYBACK SCRIPT
 * NEED_VISION
 * RECORD_UPDATE
 * NEXT_PLAYBACK
 * ELEMENT_NOT_FOUND
 *
 ** PERFORM SCRIPT
 * SCROLL_PERFORM
 * NEXT_PERFORM
 * PERFORM_RECORD_POST
 *
 */

// chrome.tabs.onActivated.addListener(function(activeInfo) {
//   console.log("tab changed ---------------------->", activeInfo);
// });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.debug("received message from content script");
  console.debug(request);
  console.log("request ===", request);
  // console.log("sender ------>", sender);

  // prevent from checkbox field recoreded as text_input
  if (request["props"] && request["props"]["attributes"] && request["props"]["attributes"]["type"] && request["props"]["attributes"]["type"] === "checkbox" && request["action"] === "text_input") {
    return;
  }

  if (request.type === "RECORD_PING") {
    // send "START_RECORDING" command only to recording tab to add the event listeners on document
    chrome.storage.local.get(["recording_tab_id", "isRecording"], items => {
      // console.log("items @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@>", items);
      if ((items.recording_tab_id === sender.tab.id || items.recording_tab_id === sender.tab.openerTabId) && items.isRecording) {
        let tabid;
        if (items.recording_tab_id === sender.tab.id) {
          tabid = items.recording_tab_id;
        } else {
          tabid = sender.tab.id;
        }
        // console.log("record window ---------------->", tabid);

        _info("sending start recording message from background");
        chrome.tabs.sendMessage(tabid, {
          action: "START_RECORDING"
        });
      }

      // ------------------------original code ---------------------

      // if (items.recording_tab_id === sender.tab.id && items.isRecording) {
      //   _info("sending start recording message from background");
      //   chrome.tabs.sendMessage(items.recording_tab_id, {
      //     action: "START_RECORDING"
      //   });
      // }

      // ------------------end------------------------
    });
  } else if (request.type === "NEED_VISION") {
    imageMatchingLogic(request.id);
  } else if (request.type === "SCROLL_PERFORM") {
    recheckPerformPage();
  } else if (request.type === "ELEMENT_NOT_FOUND") {
    // display the not found notification
    //notify("Element not found in the entire page")
  } else if (request.type === "NOTIFICATION") {
    // display the requested notification
    //notify(request.message)
  } else if (request.type === "NEXT_PERFORM") {
    chrome.storage.local.get("perform_index", ex_index => {
      chrome.storage.local.set(
        {
          perform_index: ex_index.perform_index + 1
        },
        function() {
          playbackPerformScript();
        }
      );
    });
  } else if (request.type === "PLAYBACK_PAGE_READY") {
    chrome.storage.local.get(["isPlaying", "playback_tab_id"], items => {
      if (items.playback_tab_id !== 0 && items.isPlaying) {
        playbackContentScript();
      }
    });
  } else if (request.type === "NEXT_PLAYBACK") {
    // the step is performed in the playback window, now increase the index to serve the new step
    chrome.storage.local.get("playback_index", ex_index => {
      chrome.storage.local.set(
        {
          playback_index: ex_index.playback_index + 1
        },
        () => {
          playbackContentScript();
        }
      );
    });
  } else if (request.type === "RECORD_POST") {
    console.log("came to record_post");

    // save the step - sent by content script for the recording session
    chrome.storage.local.get(["middleInsertion", "recording_session_id", "recording_session_index"], async item => {
      console.log(currentRecordingFrameLocation);
      console.log(request.frameLocation);
      if (request.frameLocation !== currentRecordingFrameLocation) {
        let newFrameLevels = request.frameLocation.split(":");
        let oldFrameLevels = currentRecordingFrameLocation.split(":");
        while (oldFrameLevels.length > newFrameLevels.length) {
          // addCommandAuto("selectFrame", [
          //     ["relative=parent"]
          // ], "");
          oldFrameLevels.pop();
        }
        while (oldFrameLevels.length != 0 && oldFrameLevels[oldFrameLevels.length - 1] != newFrameLevels[oldFrameLevels.length - 1]) {
          // addCommandAuto("selectFrame", [
          //     ["relative=parent"]
          // ], "");
          oldFrameLevels.pop();
        }
        while (oldFrameLevels.length < newFrameLevels.length) {
          // addCommandAuto("selectFrame", [
          //     ["index=" + newFrameLevels[oldFrameLevels.length]]
          // ], "");
          oldFrameLevels.push(newFrameLevels[oldFrameLevels.length]);
        }
        currentRecordingFrameLocation = request.frameLocation;
        RECORDING_SESSION_INDEX += 1;
        _error(`increasing to ${RECORDING_SESSION_INDEX}`);
        procesPostframe(request, RECORDING_SESSION_INDEX, item.recording_session_id);
      }
      _info(`request is ${request}`);

      // -----------original code------------------

      let base64data = await takeScreenshot();
      base64data ? "" : _error("BASE64DATA");
      RECORDING_SESSION_INDEX += 1;
      _error(`increasing to ${RECORDING_SESSION_INDEX}`);
      processPost(request, RECORDING_SESSION_INDEX, item.recording_session_id, base64data, sender.tab);

      // ---------------end code---------

      // const newValue = item.recording_session_index + 1
      // _error(`increasing to ${newValue}`)
      // chrome.storage.local.set({ recording_session_index: newValue }, () => {
      // 	processPost(request, newValue, item.recording_session_id, base64data, item.middleInsertion)
      // })
    });
  } else if (request.type === "PERFORM_RECORD_POST") {
    chrome.storage.local.get("perform_session_id", item => {
      chrome.storage.local.get("perform_index", index => {
        takeScreenshot().then(base64data => {
          // remaining
        });
      });
    });
  } else if (request.type === "RECORD_UPDATE") {
    // save the updated step - sent by content script after performing the step and with new metadata
    takeScreenshot().then(base64data => {
      processUpdate(request, base64data);
    });
  }
});

// take the current screenshot and then send the vision api response to perform script
const recheckPerformPage = async function() {
  const base64Data = await takeScreenshot();
  const visionResponse = await getVisionResponse(base64Data);

  chrome.storage.local.get("perform_tab_id", items => {
    chrome.tabs.sendMessage(items.perform_tab_id, {
      action: "RECHECK",
      visionResponse
    });
  });
};

/**
 * @param  {string} id
 * @returns {object} data
 * @description calls an api and try to find the element screenshot in the page screenshot
 */
const imageMatchingLogic = async function(id) {
  try {
    // get the current window screenshot
    const base64data = await takeScreenshot();
    const payload = {
      id,
      image: base64data,
      pixel_ratio: window.devicePixelRatio
    };

    // get vision url
    let vision_url = await giveUrl("vision_url");
    console.log("get graphql url", vision_url);
    // get the coordinates of element if found
    // const getCoordinatesReq = await fetch(`${constant.vision}/api/TemplateMatch`, {
    const getCoordinatesReq = await fetch(`${vision_url}/api/TemplateMatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(JSON.stringify(payload))
    });
    const getCoordinates = await getCoordinatesReq.json();

    // calculate if the vision api is able to find the element in the page
    if (getCoordinates.status === "success") {
      // get all possible coordinates
      const { x, y } = getCoordinates.scale;
      const possible_cords = [];
      const data = getCoordinates.data;

      for (const i in data) {
        possible_cords.push({
          x: (data[i]["startX"] + data[i]["endX"]) / 2,
          y: (data[i]["startY"] + data[i]["endY"]) / 2
        });
      }

      // send the positions to playback script
      chrome.storage.local.get("playback_tab_id", items => {
        chrome.tabs.sendMessage(items.playback_tab_id, {
          action: "DETECTED_POSITION",
          possible_cords,
          scale: { x, y }
        });
      });
    } else {
      // if the vision api is failed, then scroll the page and then try
      // alert("vision call + no response")
      _warning("unable to find the element in the viewport");
      chrome.storage.local.get("playback_tab_id", items => {
        chrome.tabs.sendMessage(items.playback_tab_id, {
          action: "SCROLL"
        });
      });
    }
  } catch (error) {
    _error("Error in imageMatchingLogic");
    console.error(error);
  }
};

/**
 * @description playback part
 */
export const playback = async function() {
  _warning("CALLED PLAYBACK");
  // get the testcase data
  const testcaseData = await getPlaybackStepData();

  // console.log(testcaseData);

  // if testcase data is available, then send the data to playback script
  // else, no steps are left and show the notification
  if (testcaseData === "stop") {
    //notify("Recording mode activated. Please record the steps.")
  } else if (testcaseData === "execution_end") {
    //notify("Testcase Execution Finished")
  } else {
    chrome.storage.local.get("playback_tab_id", items => {
      chrome.tabs.sendMessage(items.playback_tab_id, {
        action: "PLAY_TESTCASE",
        testcaseData
      });
    });
  }
};

/**
 * @description playback part
 */
export const perform = async function() {
  // get the testcase data
  const testcaseData = await getPerformStepData();
  const base64Data = await takeScreenshot();
  const visionResponse = await getVisionResponse(base64Data);

  // if testcase data is available, then send the data to perform script
  // else, no steps are left and show the notification
  if (testcaseData === "execution_end") {
    //notify("Testcase Execution Finished")
  } else {
    chrome.storage.local.get("perform_tab_id", items => {
      chrome.tabs.sendMessage(items.perform_tab_id, {
        action: "PERFORM_TESTCASE",
        testcaseData,
        visionResponse
      });
    });
  }
};

/**
 * @param  {string} base64
 * @description get the parsed data from google vision api
 * @returns {object} coordinates
 */
const getVisionResponse = async function(base64) {
  let googleVision_url = await giveUrl("googleVision_url");
  console.log("googleVision_url", googleVision_url);

  return new Promise((resolve, reject) => {
    // fetch(`${constant.googleVision}`, {
    fetch(`${googleVision_url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        data: base64.split(",")[1],
        scale: window.devicePixelRatio
      })
    })
      .then(res => res.json())
      .then(res => {
        resolve(res.data);
      })
      .catch(err => {
        console.log("err");
        console.log(err);
        reject(err);
      });
  });
};
