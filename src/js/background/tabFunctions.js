import { makeDescription, _info, _error, _warning, getformatteddata, getPlaybackStepData } from "./helperFunctions";
import constant from "../helpers/constant";
import { giveUrl } from "../helpers/geturls";

import { playback, perform } from "./background";
import { sendMessage } from "../playback/helperFunctions";

import { initializePlayingProgress, executionLoop } from "./playback_sel";

/**
 * @description playback phase
 */
export const playbackContentScript = function() {
  chrome.storage.local.get(["playback_tab_id", "playback_index", "window_id"], async items => {
    _info("-----------PLAYBACK_SEL_START-----------");
    await initializePlayingProgress(items.window_id, items.playback_tab_id);
    // let command = {action:"clickAt",target:"//*[@id='search-block-form']/div/div/div[1]/span/button/span",value:""}
    // await executionLoop(command,items.playback_tab_id)

    _info("Init done");
    // get the execution speed
    _info(items.playback_tab_id);

    playback_sel(items);
  });
  // get the playback tab
  // chrome.storage.local.get("playback_tab_id", items => {
  // 	// get the execution speed
  // 	chrome.storage.local.get("execution_speed", speed => {
  // 		sendDataOnInterval(items.playback_tab_id, speed.execution_speed)
  // 	})
  // })
};

/**
 * @description playback part
 */
const playback_sel = async function(items) {
  _warning("CALLED PLAYBACK");

  while (true) {
    // get the testcase data
    const testcaseData = await getPlaybackStepData();
    _warning("TestcaseData is :");
    console.log(testcaseData);

    // if testcase data is available, then send the data to playback script
    // else, no steps are left and show the notification
    if (testcaseData === "stop") {
      break;
      //notify("Recording mode activated. Please record the steps.")
    } else if (testcaseData === "execution_end") {
      break;
      //notify("Testcase Execution Finished")
    } else {
      const formatted_data = await getformatteddata(testcaseData["data"]["step_data"]);

      _warning("Formatted data is :");
      console.log(formatted_data);

      await executionLoop(formatted_data, items.playback_tab_id);

      await chromesetstorage({
        playback_index: testcaseData.index + 1
      });

      await sleep(2000);
      // chrome.storage.local.get("playback_tab_id", items => {
      // 	chrome.tabs.sendMessage(items.playback_tab_id, {
      // 		action: "PLAY_TESTCASE",
      // 		testcaseData
      // 	})
      // })
    }
  }
};

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
const chromesetstorage = async function(params) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(params, response => {
      resolve(response);
    });
  });
};

/**
 * @param  {int} tab_id
 * @description make sure that the page is ready and then send the testcase data
 */
const sendDataOnInterval = function(tab_id, ms) {
  let receivedFlag = false;
  console.log("came to tabfunction");
  console.log(tab_id);

  chrome.tabs.get(Number(tab_id), () => {
    chrome.storage.local.get("playback_tab_id", items => {
      if (!chrome.runtime.lastError && tab_id === items.playback_tab_id) {
        let sendOnInterval = setInterval(() => {
          if (receivedFlag) {
            // identify if the element is present in the current viewport
            _warning("page is ready to get the event data");
            clearInterval(sendOnInterval);
            playback();
            return;
          } else {
            chrome.tabs.sendMessage(tab_id, { action: "PING" }, response => {
              if (response) {
                receivedFlag = true;
              }
            });
          }
        }, ms);
      }
    });
  });
};

/**
 * @description perform phase
 */
export const playbackPerformScript = function() {
  // get the playback tab
  chrome.storage.local.get("perform_tab_id", items => {
    sendPlaybackDataOnInterval(items.perform_tab_id, 3000);
  });
};

/**
 * @param  {int} tab_id
 * @description send message to the tab where the test is running
 */
const sendPlaybackDataOnInterval = function(tab_id, ms) {
  console.log("inside sendPlaybackDataOnInterval");

  let receivedFlag = false;

  let sendOnInterval = setInterval(() => {
    if (receivedFlag) {
      // identify if the element is present in the current viewport
      _warning("page is ready to get the event data");
      clearInterval(sendOnInterval);
      perform();
    } else {
      chrome.tabs.sendMessage(tab_id, { action: "PERFORM_PING" }, response => {
        if (response !== "PERFORM_PONG") {
          console.log("response received");
          receivedFlag = true;
        }
      });
    }
  }, ms);
};

/**
 * @param  {string} name
 * @param  {string} url
 * @description open a new window for recording the events
 */
export const openRecordingWindow = async function(name, description, url, app_id, feature_id) {
  return new Promise((resolve, reject) => {
    // create window - tab
    chrome.windows.create(
      {
        url: url,
        state: "maximized"
      },
      window => {
        console.log("tab function -------->", window);

        chrome.storage.local.set(
          {
            recording_tab_id: window.tabs[0]["id"],
            isRecording: true,
            isPlaying: false
          },
          function() {
            // disable the zoom on newly created tab
            chrome.tabs.setZoomSettings(window.tabs[0]["id"], {
              mode: "disabled",
              scope: "per-origin"
            });

            // for dev
            // chrome.storage.local.set({recording_session_id: "dev"})

            const testcase_id = recordingProcessing(name, description, url, app_id, feature_id);
            resolve(testcase_id);
          }
        );
      }
    );
  });
};

/**
 * Step1: Create Object repository entry
 * Step2: Create Testcase component
 * Step3: Create Testcase
 */
const recordingProcessing = async function(name, description, url, app_id, feature_id) {
  // dev only
  // chrome.storage.local.set({recording_session_id: testcaseResp.id})

  // multi comment this line for testing

  // Create Testcase
  let strapi_url = await giveUrl("strapi_url");
  // const createTestcase = await fetch(`${constant.strapi_url}/testcases`, {
  const createTestcase = await fetch(`${strapi_url}/testcases`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      type: "ui",
      description,
      feature: feature_id,
      application: app_id
    })
  });

  const testcaseResp = await createTestcase.json();

  // Create Testcase component
  // set the session id - to record the related test actions
  chrome.storage.local.set({ recording_session_id: testcaseResp.id });

  // Create Object repository entry
  // const createOR = await fetch(`${constant.strapi_url}/objectrepositories`, {
  const createOR = await fetch(`${strapi_url}/objectrepositories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "open_url",
      url,
      description: makeDescription("open_url", url)
    })
  });
  const orResp = await createOR.json();

  // const createTestComp = await fetch(`${constant.strapi_url}/testcasecomponents`, {
  const createTestComp = await fetch(`${strapi_url}/testcasecomponents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "ui",
      sequence_number: 1,
      objectrepository: orResp.id,
      testcase: testcaseResp.id
    })
  });

  const testCompResp = await createTestComp.json();

  // */

  _warning("test step added successfully");
  return testcaseResp.id;
};

/**
 * @description close the current recording window
 */
export const closeRecordingWindow = function() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("recording_tab_id", items => {
      _info(`will remove tab ${items.recording_tab_id}`);
      chrome.tabs.remove(items.recording_tab_id, function() {
        // clear the recording related storage values
        chrome.storage.local.set(
          {
            recording_session_id: 0,
            recording_tab_id: 0
          },
          () => {
            resolve("done");
          }
        );
      });
    });
  });
};

/**
 * @param  {string} url
 * @param  {int} height
 * @param  {int} width
 * @description open a new window for playback
 */
export const openPlaybackWindow = function(url, height, width) {
  // create window - tab
  const createObj = { url };
  if (width) {
    createObj["width"] = width;
  }
  if (height) {
    createObj["height"] = height;
  }

  chrome.windows.create(createObj, window => {
    console.log(window);

    chrome.storage.local.set(
      {
        playback_tab_id: window.tabs[0]["id"],
        playback_index: 1,
        window_id: window.id
      },
      function() {
        // disable the zoom on newly created tab
        chrome.tabs.setZoomSettings(window.tabs[0]["id"], {
          mode: "disabled",
          scope: "per-origin"
        });

        // playbackContentScript()
      }
    );
  });
};

/**
 * @param  {string} url
 * @description open a new window to perform the custom testcase
 */
export const openPerformWindow = async function(session_id) {
  let strapi_url = await giveUrl("strapi_url");
  try {
    const firstStepDetails = await getRelatedNLUDetails(session_id);
    const parsedFirstStepDetails = await performNLU(firstStepDetails.nlu_text);

    if (parsedFirstStepDetails.status === "success") {
      if (parsedFirstStepDetails.intent === "OPEN_URL") {
        let url = parsedFirstStepDetails.entities[0];
        if (!url.includes("http") && !url.includes("https")) {
          url = `http://${url}`;
        }

        chrome.windows.create(
          {
            url,
            state: "maximized"
          },
          window => {
            chrome.storage.local.set(
              {
                perform_session_id: session_id,
                perform_tab_id: window.tabs[0]["id"],
                perform_index: 1
              },
              function() {
                // disable the zoom on newly created tab
                chrome.tabs.setZoomSettings(window.tabs[0]["id"], {
                  mode: "disabled",
                  scope: "per-origin"
                });

                // api call to add first test step of created session
                const post_data = {
                  index: 1,
                  tblsession: session_id,
                  action: "open_url",
                  description: makeDescription("open_url", parsedFirstStepDetails.entities[0])
                };

                // fetch(`${constant.strapi_url}/tblsteps`, {
                fetch(`${strapi_url}/tblsteps`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify(post_data)
                })
                  .then(res => res.json())
                  .then(res => {
                    _info("perform first step inserted");
                    playbackPerformScript();
                  })
                  .catch(err => {
                    _error("error in api call");
                    console.error(err);
                  });
              }
            );
          }
        );
      }
    } else {
      alert("The data provided was not sufficient for the testcase to run.");
    }
  } catch (error) {
    alert("Error in openPerformWindow method");
    console.log(error);
  }
};

/**
 * @param  {string} session_id
 * @description get the nlu details of related steps from nluData table
 */
const getRelatedNLUDetails = async function(session_id) {
  let strapi_url = await giveUrl("strapi_url");

  return new Promise((resolve, reject) => {
    // fetch(`${constant.strapi_url}/nludata?tblsession=${session_id}&_sort=sequence:ASC`, {
    fetch(`${strapi_url}/nludata?tblsession=${session_id}&_sort=sequence:ASC`, {
      method: "GET"
    })
      .then(res => res.json())
      .then(res => {
        const related = [];
        _.map(res, function(o) {
          if (o.tblsession) {
            if (o.tblsession.id === session_id) {
              related.push(o);
            }
          }
        });

        chrome.storage.local.set(
          {
            performSessionData: {
              data: related
            }
          },
          function() {
            resolve(related[0]);
          }
        );
      })
      .catch(err => {
        _error("error in getRelatedNLUDetails api call");
        console.log(err);
        reject(err);
      });
  });
};

/**
 * @param {string} text
 * @returns {object} nlu status, intent and entities
 * @description get the intent and entities for the given step description
 */
export const performNLU = async function(text) {
  return new Promise((resolve, reject) => {
    fetch(`${constant.nlu_url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text
      })
    })
      .then(res => res.json())
      .then(res => {
        // if the response is present
        if (res) {
          // if the matching threshold is higher than the defined one
          if (res.intent.confidence >= constant.nlu_matching_threshold) {
            const intent = res.intent.name;
            const entities = extractAllText(text);
            resolve({
              status: "success",
              intent,
              entities
            });
          } else {
            resolve({
              status: "failed"
            });
          }
        }
      })
      .catch(err => {
        _error("error in performNLU api call");
        console.log(err);
        reject(err);
      });
  });
};

/**
 * @param  {string} str
 * @returns {Array} entities
 * @description get the entities for the given text
 */
const extractAllText = function(str) {
  const re = /"(.*?)"/g;
  const result = [];
  let current;
  while ((current = re.exec(str))) {
    result.push(current.pop());
  }
  return result.length > 0 ? result : [str];
};
