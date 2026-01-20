import _ from "lodash";
import { performNLU } from "./tabFunctions";

/**
 * @param  {string} action Eg. open_url, mouselclick, text_input
 * @param  {string} value value of the element (for url and text_input)
 * @param  {string} field field name of the element
 */
export const makeDescription = function(action, value, field) {
  console.log("description --------------->", action, value, field);

  const url = ['goto "url"', 'open "url"', 'navigate to "url"'];
  const click = ['perform "click"', 'do "click"'];
  const type = ["type in", "type", "assign", "fill", "enter", "put"];
  const drag = ["dragged", "drag from", "drag"];
  const drop = ["dropped", "drop to", "drop"];
  const mouseover = ["hover", "mouseover"];

  if (action === "open_url") {
    return `${_.sample(url)} - ${value}`;
  } else if (value === "${KEY_TAB}") {
    return "perform Tab";
  } else if (field === "dropdown") {
    return `set ${value} in dropdown`;
  } else if (action.includes("click")) {
    return `${_.sample(click)} - ${field}`;
  } else if (action === "text_input") {
    return `${_.sample(type)} "${field}" - ${value}`;
  } else if (action === "drag") {
    return `${_.sample(drag)} - ${value}`;
  } else if (action === "drop") {
    return `${_.sample(drop)} - ${value}`;
  } else if (action === "mouseover") {
    return `${_.sample(mouseover)} - ${value}`;
  }
};

/**
 * @returns {string} random id
 * @description generate and return random id
 */
export const makeid = function(length) {
  let text = "";
  let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
};

/**
 * @returns {string} base64 data of current viewport
 * @description capture the screenshot of current viewport
 */
export const takeScreenshot = function() {
  return new Promise((resolve, reject) => {
    // setTimeout(function() {
    try {
      chrome.tabs.captureVisibleTab(null, { format: "png" }, data => {
        resolve(data);
      });
    } catch (error) {
      _error("error in takeScreenshot");
      console.error(error);
      reject(error);
    }
    // }, 200);
  });
};

/**
 * @returns {object} test step data
 * @description get current playback action data
 */
export const getPlaybackStepData = function() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(["playback_index", "playback_tab_id", "playbacksession", "playback_session_id", "playback_add_steps_at"], items => {
        console.log("helper function ------------>", items);

        let ex_index = items.playback_index;
        let stop_step = 0;
        stop_step = items.playback_add_steps_at;

        // if some steps need to be added inside, then don't run the playback steps

        if (stop_step !== 0 && ex_index === stop_step) {
          // swap the storage values of playback and recording to change to recording mode
          chrome.storage.local.set(
            {
              middleInsertion: stop_step,
              current_action: "record_in_execution",
              recording_tab_id: items.playback_tab_id,
              recording_session_id: items.playback_session_id,
              recording_session_index: 0
            },
            () => {
              _info("sending start recording message from tabfunctions");
              chrome.tabs.sendMessage(items.playback_tab_id, {
                action: "START_RECORDING"
              });

              if (ex_index === stop_step) {
                chrome.storage.local.set({
                  playback_index: 0
                });
              }
              resolve("stop");
            }
          );
        } else {
          // normal playback
          const testcaseDetails = items.playbacksession.data[ex_index];

          // if testcase details are present, then send it for the execution
          // else notify the user that the test is ended

          if (testcaseDetails) {
            if (testcaseDetails.action === "drag") {
              resolve({
                event: "drag_drop",
                drag: items.playbacksession.data[ex_index],
                drop: items.playbacksession.data[ex_index + 1],
                index: ex_index
              });
            } else {
              resolve({
                event: testcaseDetails["step_data"]["action"],
                data: testcaseDetails,
                index: ex_index
              });
            }
          } else {
            resolve("execution_end");
          }
        }
      });
    } catch (error) {
      _error("error in getTestcaseData");
      console.error(error);
      reject(error);
    }
  });
};

/**
 * @returns {object} formatted testdata
 * @description formats the data
 */
export const getformatteddata = function(element_data) {
  let return_obj = {};

  // set element_value
  return_obj["value"] = element_data.element_value ? element_data.element_value : element_data.value ? element_data.value : "";

  if (element_data.action) {
    if (element_data.action === "mouselclick") {
      return_obj["action"] = "click";
    } else if (element_data.action === "text_input") {
      return_obj["action"] = "type";
    } else if (element_data.action === "mouseover") {
      return_obj["action"] = "mouseOver";
    }
  }
  if (element_data.element_attributes.name) {
    return_obj["target"] = `name=${element_data.element_attributes.name}`;
  } else if (element_data.element_id) {
    return_obj["target"] = `id=${element_data.element_id}`;
  } else if (element_data.element_css) {
    if (element_data.element_css.split(" ").length > 1) {
      let classes = "";
      element_data.element_css.split(" ").map(classname => {
        classes = classes + `.${classname}`;
      });
      return_obj["target"] = `css=${classes}`;
    } else {
      return_obj["target"] = `css=${element_data.element_css}`;
    }
  } else if (element_data.element_xpaths) {
    if (element_data.element_xpaths[0]) {
      return_obj["target"] = element_data.element_xpaths[0];
    }
  }
  return return_obj;
};

/**
 * @returns {object} test step data
 * @description get current perform action data
 */
export const getPerformStepData = function() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get("perform_index", ex_index => {
        chrome.storage.local.get("performSessionData", items => {
          ex_index = ex_index.perform_index;
          const testcaseDetails = items.performSessionData.data[ex_index];

          // if testcase details are present, then send it for the execution
          // else notify the user that the test is ended

          if (testcaseDetails) {
            if (testcaseDetails.nlu_text.length > 0) {
              performNLU(testcaseDetails.nlu_text)
                .then(resp => {
                  if (resp.status === "success") {
                    resolve({
                      intent: resp.intent,
                      entities: resp.entities,
                      text: testcaseDetails.nlu_text
                    });
                  } else {
                    alert("The data provided was not sufficient for the testcase to run.");
                  }
                })
                .catch(err => {
                  _error("error in nlu passing");
                  console.error(err);
                  reject(err);
                });
            }
          } else {
            resolve("execution_end");
          }
        });
      });
    } catch (error) {
      _error("error in getTestcaseData");
      console.error(error);
      reject(error);
    }
  });
};

/**
 * @param  {string} msg
 * @description display a chrome notification
 */
export const notify = function(msg) {
  const options = {
    type: "basic",
    title: "AI Tester",
    iconUrl: "./ext-icon.png",
    message: msg
  };
  chrome.notifications.create(options);
};

/**
 * @param  {string} msg
 */
export const _error = function(msg) {
  console.log("%c " + msg, "background: #f00; color: #fff");
};

/**
 * @param  {string} msg
 */
export const _warning = function(msg) {
  console.log("%c " + msg, "background: #ff9f43; color: #000");
};

/**
 * @param  {string} msg
 */
export const _info = function(msg) {
  console.log("%c " + msg, "background: #2d3436; color: #ffeaa7");
};
