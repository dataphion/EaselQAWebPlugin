import "../../css/options.css";
import { _error, _info, _warning } from "../background/helperFunctions";
import { collectProps, filterxpath } from "../helpers/propsHelpers";
import { getText, normalizeSpaces } from "../content/utils";

import { LocatorBuilders } from "../helpers/locator-builders";
import { over } from "lodash";
// import './record-handler'

// these variables are to get the anchor element
let ANCHOR_MODE = false;
let GRID_MODE = false;
let mouse_pos_x = 0;
let mouse_pos_y = 0;
let timer;
let previous_ele = null;

let eR = {};

let CURRENT_FOCUSED_ELEMENT = null;

let attached = false;
export class EventRecorder {
  constructor(window) {
    this.window = window;
    console.log("builder element window ------------>");
    this.locatorBuilders = new LocatorBuilders(window);

    const { frameLocation, framelocationelement } = this.getFrameLocation();
    this.frameLocation = frameLocation;
    this.framelocationelement = framelocationelement;
    chrome.runtime.sendMessage({
      frameLocation: this.frameLocation,
    });
  }

  /**
   * @description insert the timer cursor to anchor the element
   */
  addAnchorCursor = () => {
    // add cursor in the body
    const cur = document.createElement("div");
    cur.id = "phion_cursor";

    // on the animation end, pick the element from the points
    cur.addEventListener(
      "animationend",
      () => {
        _info(`picking from ${mouse_pos_x} & ${mouse_pos_y} - actual ${mouse_pos_y - window.pageYOffset}`);
        const elt = document.elementFromPoint(mouse_pos_x, mouse_pos_y - window.pageYOffset);
        this.recordStep(null, "ANCHOR", elt);
        // reset the outline and remove cursor from body
        elt.style.outline = "0px";
        ANCHOR_MODE = false;
        const cur = document.getElementById("phion_cursor");
        cur.parentNode.removeChild(cur);
      },
      false
    );
    document.body.appendChild(cur);
  };

  /**
   * DOM events
   */

  // restart the cursor animation
  onMouseMoveEvent = (e) => {
    if (ANCHOR_MODE) {
      clearTimeout(timer);
      const cur = document.getElementById("phion_cursor");
      cur.style.animation = "none";
      cur.offsetHeight;
      cur.style.animation = null;
      mouse_pos_x = e.pageX;
      mouse_pos_y = e.pageY;
      cur.setAttribute("style", "top: " + (e.pageY - 30) + "px; left: " + (e.pageX - 30) + "px;");
    }
  };

  draw = (e) => {
    console.log("grid_mode", GRID_MODE);
    if (previous_ele) {
      previous_ele.style.background = "";
    }
    if (GRID_MODE) {
      // console.log("target element --->", e.target);
      let current_ele = e.target;
      console.log("current ele ---->", current_ele);
      console.log("previous_ele ---->", previous_ele);
      if (previous_ele !== current_ele) {
        current_ele.style.background = "rgba(120, 170, 210, 0.7)";
        previous_ele = current_ele;
      }

      // if (OVERLAY_ELEMENT !== e.target) {
      //   e.target.style.background = "rgba(120, 170, 210, 0.7)";
      //   OVERLAY_ELEMENT.style.background = "";
      //   OVERLAY_ELEMENT = e.target
      // }

      // OVERLAY_ELEMENT = e.target;

      // e.target.style.outline = "3px dotted red !important";
      // e.target.style.border = "3px dotted red";
      // e.target.style.color = "green";
    }
  };

  getData = (e) => {
    // let element = document.getElementById("validation-div");
    // element.parentNode.removeChild(element);
    if (GRID_MODE) {
      this.getXPath(e.target);
      // GRID_MODE = false;
    }
  };

  getXPath = (el) => {
    // CODE TO GET FULL XPATH
    let nodeElem = el;
    const parts = [];
    while (nodeElem && nodeElem.nodeType === Node.ELEMENT_NODE) {
      let nbOfPreviousSiblings = 0;
      let hasNextSiblings = false;
      let sibling = nodeElem.previousSibling;
      while (sibling) {
        if (sibling.nodeType !== Node.DOCUMENT_TYPE_NODE && sibling.nodeName === nodeElem.nodeName) {
          nbOfPreviousSiblings++;
        }
        sibling = sibling.previousSibling;
      }
      sibling = nodeElem.nextSibling;
      while (sibling) {
        if (sibling.nodeName === nodeElem.nodeName) {
          hasNextSiblings = true;
          break;
        }
        sibling = sibling.nextSibling;
      }
      const prefix = nodeElem.prefix ? nodeElem.prefix + ":" : "";
      const nth = nbOfPreviousSiblings || hasNextSiblings ? `[${nbOfPreviousSiblings + 1}]` : "";
      parts.push(prefix + nodeElem.localName + nth);
      nodeElem = nodeElem.parentNode;
    }
    let full_xpath = [parts.length ? "/" + parts.reverse().join("/") : "", "full xpath"];
    console.log("full xpaths from record.js ---->", full_xpath[0]);
    chrome.storage.local.set({ grid_xpath: full_xpath[0] }, function () {
      console.log("Value is set to " + full_xpath[0]);
    });
    GRID_MODE = false;
    // show msg for xpath captured
    this.showmsg(full_xpath[0]);
  };

  showmsg = (page_xpath) => {
    // create element to show msg
    var x = document.createElement("div");
    x.setAttribute("id", "capture-msg");
    // x.src = "data:text/html;charset=utf-8," + escape("your selected locator is captured as Grid pagination element");
    x.innerText = `Captured pagination path : ${page_xpath}`;
    // x.style;
    // x.style.bottom = "0";
    // x.style.left = "0";
    // x.style.cursor = "initial !important";
    // x.style.padding = "10px";
    // x.style.background = "#a55eea";
    // x.style.color = "white";
    // x.style.position = "fixed";
    // x.style.fontSize = "16px";
    // x.style.zIndex = "10000001";
    // x.style.height = "50px";
    // document.body.appendChild(x);

    // x.style;
    x.style.bottom = "0";
    x.style.cursor = "initial !important";
    x.style.left = "0";
    x.style.background = "#a55eea";
    x.style.padding = "10px";
    x.style.position = "fixed";
    x.style.color = "white";
    x.style.fontSize = "16px";
    x.style.zIndex = "10000001";
    x.style.height = "50px";
    document.body.appendChild(x);

    // remove notification after 5sec
    setTimeout(function () {
      let element = document.getElementById("capture-msg");
      element.parentNode.removeChild(element);
    }, 4000);
  };

  // on mouse over, add the dotted outline
  onmouseoverevent = (e) => {
    if (ANCHOR_MODE) {
      e.target.style.outline = "1px dotted red";
    } else {
      // console.log("current element ---->", e.target.id);
      // console.log(e.hasAttribute("overlay-ele"));
      if (
        e.target.id !== "overlay-ele" &&
        e.target.id !== "validation-div" &&
        e.target.id !== "validation-dropdown" &&
        e.target.id !== "validation-action-row" &&
        e.target.id !== "validation-action-label" &&
        e.target.id !== "validation-action-showdetails" &&
        e.target.id !== "valiadtion-contain-text-header" &&
        e.target.id !== "validation-contains-input-text" &&
        e.target.id !== "validation-action-row-element" &&
        e.target.id !== "validation-save-step-button-container" &&
        e.target.id !== "validation-save-step-button"
      ) {
        console.log(" current ele -------------------->", e);
        CURRENT_FOCUSED_ELEMENT = e;
        e.target.style.outline = "2px solid black";
        // e.target.style.border = "2px solid black";
      }
    }
  };

  showValidationList = async (e, show) => {
    // console.log("show list -->", e, show);
    console.log("this --->", this);
    let _this = this;
    var x = document.createElement("div");

    if (show === "show") {
      let validation_type = "text_validation";
      async function selectValidation(e) {
        if (e.target.value === "text_validation" || e.target.value === "element_validation") {
          validation_type = e.target.value;
        }

        // save step --
        function saveSteps() {
          console.log("save steps", validation_type);
          console.log(_this);
          _this.record(CURRENT_FOCUSED_ELEMENT, validation_type.toUpperCase(), _this.locatorBuilders.buildAll(CURRENT_FOCUSED_ELEMENT.target), CURRENT_FOCUSED_ELEMENT.target.value);
          // successfull msg
          var msg = document.createElement("div");
          msg.setAttribute("id", "step-created-msg");
          // x.src = "data:text/html;charset=utf-8," + escape("your selected locator is captured as Grid pagination element");
          msg.innerText = `Step saved Successfully!`;
          msg.style;
          msg.style.bottom = "0";
          msg.style.top = "0";
          msg.style.left = "780px";
          msg.style.cursor = "initial !important";
          msg.style.padding = "18px";
          msg.style.background = "rgb(25, 42, 86)";
          msg.style.color = "white";
          msg.style.position = "fixed";
          msg.style.fontSize = "16px";
          msg.style.zIndex = "10000001";
          msg.style.height = "60px";
          msg.style.width = "230px";
          // msg.style.padding = "18px";
          document.body.appendChild(msg);

          // remove notification after 5sec

          setTimeout(function () {
            let element = document.getElementById("step-created-msg");
            element.remove();
          }, 3000);
        }

        // get element text
        console.log("current focused element--->", CURRENT_FOCUSED_ELEMENT.target.value);
        console.log("current focused element value--->", CURRENT_FOCUSED_ELEMENT.target.innerText);
        let element_text = "";
        if (CURRENT_FOCUSED_ELEMENT.target.innerText && CURRENT_FOCUSED_ELEMENT.target.innerText !== "") {
          console.log("inside innder text");
          element_text = CURRENT_FOCUSED_ELEMENT.target.innerText;
        } else if (CURRENT_FOCUSED_ELEMENT.target.value) {
          console.log("inside innder text");
          element_text = CURRENT_FOCUSED_ELEMENT.target.value;
        }

        if (e.target.value === "element_validation") {
          let xpath = _this.locatorBuilders.buildAll(CURRENT_FOCUSED_ELEMENT.target);
          // get element xpath
          xpath = await filterxpath(xpath.locators);
          console.log(" elements xpath", xpath);
          x.removeChild(document.getElementById("validation-action-row"));
          var action_row = document.createElement("div");
          action_row.setAttribute("id", "validation-action-row-element");
          // action row css
          action_row.style.display = "flex";
          action_row.style.justifyContent = "center";
          /* align-items: center; */
          action_row.style.flexDirection = "column";
          action_row.style.padding = "10px";
          action_row.style.marginTop = "8px";
          action_row.style.width = "100%";
          action_row.style.background = "rgba(60,64,67,.30)";

          let action_label = document.createElement("span");
          action_label.setAttribute("id", "validation-action-label");
          action_label.innerText = "ACTION";
          action_label.style.fontFamily = "inherit";

          let action_showdetails = document.createElement("div");
          action_showdetails.setAttribute("id", "validation-action-showdetails");
          // css
          action_showdetails.style.display = "flex";
          action_showdetails.style.justifyContent = "center";
          action_showdetails.style.flexDirection = "column";
          action_showdetails.style.fontFamily = "inherit";
          action_showdetails.style.marginTop = "15px";
          action_showdetails.style.fontSize = "15px";
          // }

          let contain_text_header = document.createElement("span");
          contain_text_header.setAttribute("id", "valiadtion-contain-text-header");
          contain_text_header.innerText = "ELEMENT";

          let contain_text_value = document.createElement("input");
          contain_text_value.setAttribute("id", "validation-contains-input-text");
          contain_text_value.setAttribute("disabled", true);
          contain_text_value.setAttribute("value", xpath.length > 0 ? xpath[0] : "");
          contain_text_value.style.padding = "6px";
          contain_text_value.style.fontSize = "15px";
          contain_text_value.style.boxShadow = "none";
          contain_text_value.style.border = "none";
          contain_text_value.style.marginTop = "5px";
          contain_text_value.style.color = "black";
          contain_text_value.style.background = "#ffffffa8";

          // Save step button
          let save_btn_container = document.createElement("div");
          save_btn_container.setAttribute("id", "validation-save-step-button-container");
          // css
          save_btn_container.style.display = "flex";
          save_btn_container.style.justifyContent = "flex-end";
          save_btn_container.style.marginTop = "15px";
          save_btn_container.style.height = "30px";

          let save_step_button = document.createElement("button");
          save_step_button.setAttribute("id", "validation-save-step-button");
          // css
          save_step_button.innerText = "SAVE STEP";
          save_step_button.style.background = "#ffff";
          save_step_button.style.fontSize = "15px";
          save_step_button.style.fontFamily = "inherit";
          save_step_button.style.border = "none";
          save_step_button.style.cursor = "pointer";
          save_step_button.style.fontWeight = "600";
          save_step_button.style.color = "black";

          save_step_button.onclick = saveSteps;

          save_btn_container.appendChild(save_step_button);

          //
          action_showdetails.appendChild(contain_text_header);
          action_showdetails.appendChild(contain_text_value);

          action_row.appendChild(action_label);
          action_row.appendChild(action_showdetails);
          action_row.appendChild(save_btn_container);

          x.appendChild(action_row);
        }
        // else if (e.target.value === "text_validation") {
        else {
          let removed_ele = document.getElementById("validation-action-row-element");
          console.log("find-ele", removed_ele);
          if (removed_ele) {
            console.log("remove element ---->");
            x.removeChild(document.getElementById("validation-action-row-element"));
          }

          // ---------Action Row
          var action_row = document.createElement("div");
          action_row.setAttribute("id", "validation-action-row");
          // action row css
          action_row.style.display = "flex";
          action_row.style.justifyContent = "center";
          /* align-items: center; */
          action_row.style.flexDirection = "column";
          action_row.style.padding = "10px";
          action_row.style.marginTop = "8px";
          action_row.style.width = "100%";
          action_row.style.background = "rgba(60,64,67,.30)";

          let action_label = document.createElement("span");
          action_label.setAttribute("id", "validation-action-label");
          action_label.innerText = "ACTION";
          action_label.style.fontFamily = "inherit";

          let action_showdetails = document.createElement("div");
          action_showdetails.setAttribute("id", "validation-action-showdetails");
          // css
          action_showdetails.style.display = "flex";
          action_showdetails.style.justifyContent = "center";
          action_showdetails.style.flexDirection = "column";
          action_showdetails.style.fontFamily = "inherit";
          action_showdetails.style.marginTop = "15px";
          action_showdetails.style.fontSize = "15px";
          // }

          let contain_text_header = document.createElement("span");
          contain_text_header.setAttribute("id", "valiadtion-contain-text-header");
          contain_text_header.innerText = "INPUT TEXT";

          let contain_text_value = document.createElement("input");
          contain_text_value.setAttribute("id", "validation-contains-input-text");
          contain_text_value.setAttribute("disabled", true);
          contain_text_value.setAttribute("value", element_text);
          contain_text_value.style.padding = "6px";
          contain_text_value.style.fontSize = "15px";
          contain_text_value.style.boxShadow = "none";
          contain_text_value.style.border = "none";
          contain_text_value.style.marginTop = "5px";
          contain_text_value.style.color = "black";
          contain_text_value.style.background = "#ffffffa8";

          // Save step button
          let save_btn_container = document.createElement("div");
          save_btn_container.setAttribute("id", "validation-save-step-button-container");
          // css
          save_btn_container.style.display = "flex";
          save_btn_container.style.justifyContent = "flex-end";
          save_btn_container.style.marginTop = "15px";
          save_btn_container.style.height = "30px";

          let save_step_button = document.createElement("button");
          save_step_button.setAttribute("id", "validation-save-step-button");
          // css
          save_step_button.innerText = "SAVE STEP";
          save_step_button.style.background = "#ffff";
          save_step_button.style.fontSize = "15px";
          save_step_button.style.fontFamily = "inherit";
          save_step_button.style.border = "none";
          save_step_button.style.cursor = "pointer";
          save_step_button.style.fontWeight = "600";
          save_step_button.style.color = "black";

          save_step_button.onclick = saveSteps;

          save_btn_container.appendChild(save_step_button);

          //
          action_showdetails.appendChild(contain_text_header);
          action_showdetails.appendChild(contain_text_value);

          action_row.appendChild(action_label);
          action_row.appendChild(action_showdetails);
          action_row.appendChild(save_btn_container);

          x.appendChild(action_row);

          // ------------------Completed-------------
        }
      }

      var overlay = document.createElement("div");
      overlay.setAttribute("id", "overlay-ele");
      overlay.style;
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.backgroundColor = "rgb(16 15 15 / 61%)";
      overlay.style.cursor = "pointer";

      // var x = document.createElement("div");

      x.setAttribute("id", "validation-div");
      x.style;
      x.style.display = "flex";
      x.style.justifyContent = "center";
      x.style.alignItems = "center";
      x.style.flexDirection = "column";
      x.style.bottom = "0";
      x.style.left = "0";
      x.style.top = "350px";
      // x.style.left = "900px";
      x.style.cursor = "initial !important";
      x.style.padding = "15px";
      x.style.background = "#192a56";
      x.style.color = "white";
      x.style.position = "relative";
      x.style.fontSize = "16px";
      x.style.zIndex = "10000001";
      // x.style.height = "65px";
      x.style.maxWidth = "300px";

      var newList = document.createElement("select");
      newList.setAttribute("id", "validation-dropdown");
      var newListData = new Option("Text Validation", "text_validation");
      // newListData = new Option("ele_validation", "Element Validation");

      newList.appendChild(newListData);
      newList.appendChild(new Option("Element Validation", "element_validation"));
      // newList.setAttribute("onChange", "fun()");
      newList.onchange = selectValidation;
      newList.style;
      newList.style.width = "200px";
      newList.style.height = "30px";
      newList.style.borderRadius = "2px";
      newList.style.outline = "none";
      newList.style.fontSize = "17px";
      newList.style.background = "#ffff";
      newList.style.color = "black";

      x.appendChild(newList);

      overlay.appendChild(x);

      document.body.appendChild(overlay);
      selectValidation(e);

      // this.remove();
    }
  };

  // on mouse out, remove the dotted outline
  onMouseOutEvent = (e) => {
    // if (ANCHOR_MODE) {
    e.target.style.outline = "0px";
    // }
  };

  // left mouse click
  leftClickEvent = (e) => {
    // if trusted, then only record it
    console.log("clicked event ---->", e);

    if (e.isTrusted) {
      // for dropdown, don't record the event
      if (!["select"].includes(e.target.nodeName.toLowerCase())) {
        // if the event was performed on the linked checkbox element, it will generate two events
        // first from label and second from checkbox itself
        // in this case, don't record the checkbox event
        if (e.target.nodeName.toLowerCase() === "label") {
          if (e.target.control) {
            let linkedElement = e.target.control;
            if (linkedElement.nodeName.toLowerCase() === "input") {
              if (linkedElement.type !== "checkbox") {
                this.recordStep(e, "MOUSELCLICK");
              }
            }
          }
        } else {
          this.recordStep(e, "MOUSELCLICK");
        }
      }
    }
  };

  // right click event
  contextMenuEvent = (e) => {
    this.recordStep(e, "MOUSERCLICK");
  };

  // double click event
  doubleClickEvent = (e) => {
    this.recordStep(e, "MOUSEDCLICK");
  };

  // input and textarea events
  onBlur = (e) => {
    if (["input", "textarea"].includes(e.target.tagName.toLowerCase())) {
      if (!["checkbox", "radio"].includes(e.target.type.toLowerCase())) {
        this.recordStep(e, "KEY");
      }
    }
  };

  // input and textarea events
  onKeyDown = (e) => {
    if (["input", "textarea"].includes(e.target.tagName.toLowerCase())) {
      if (!["checkbox", "radio"].includes(e.target.type.toLowerCase())) {
        this.recordStep(e, "KEY");
      }
    }
  };

  // for dropdown event
  onchangeEvent = (e) => {
    // console.log("dropdown", e);

    if (["select"].includes(e.target.tagName.toLowerCase())) {
      this.recordStep(e, "DROPDOWN");
    }
  };

  // drag and drop events
  onDragEvent = (e) => {
    this.recordStep(e, "DRAG");
  };
  onDropEvent = (e) => {
    this.recordStep(e, "DROP");
  };

  /**
   * @param {any} msg - any message type
   * @returns {void} - nothing
   * @description sends message from content script to background script
   */
  sendMessage = (msg) => {
    try {
      if (chrome.runtime && chrome.runtime.onMessage) {
        if (!chrome.runtime.lastError) {
          chrome.runtime.sendMessage(msg);
        }
      }
    } catch (err) {
      _error("Unable to send the message to background script");
      console.error(err);
    }
  };

  /**
   * @param  {object} e
   * @param  {string} type
   * @param  {object} props
   * @description send the step data to background script
   */
  sendUpdate = (e, type, props, value, frame, xpath) => {
    // prepare data to send
    if (type === "FILEUPLOAD") {
      this.sendMessage({
        type: "RECORD_POST",
        action: "fileupload",
        value: value,
        frameLocation: frame,
        props,
      });
    } else if (type === "KEY") {
      this.sendMessage({
        type: "RECORD_POST",
        action: "text_input",
        value: value,
        frameLocation: frame,
        props,
      });
    } else if (type === "DROPDOWN") {
      const sendObj = {
        type: "RECORD_POST",
        action: "dropdown",
        value: e.target ? e.target.value : "",
        frameLocation: frame,
        props,
      };
      // console.log("dropdown props -------------->", sendObj);

      this.sendMessage(sendObj);
    } else if (type === "DRAG") {
      this.sendMessage({
        type: "RECORD_POST",
        action: "drag",
        value: e.target ? e.target.value : "",
        value: e.target ? e.target.value : "",
        frameLocation: frame,
        props,
        xpath,
      });
    } else if (type === "DROP") {
      this.sendMessage({
        type: "RECORD_POST",
        action: "drop",
        value: e.target ? e.target.value : "",
        frameLocation: frame,
        props,
        xpath,
      });
    } else if (type === "mouseover") {
      this.sendMessage({
        type: "RECORD_POST",
        action: "mouseover",
        value: e.target ? e.target.value : "",
        frameLocation: frame,
        props,
        xpath,
      });
    } else if (type === "ANCHOR") {
      this.sendMessage({
        type: "RECORD_ANCHOR",
        action: "anchor",
        value: "",
        frameLocation: frame,
        props,
      });
    } else {
      const sendObj = {
        type: "RECORD_POST",
        action: type.toLowerCase(),
        frameLocation: frame,
        props,
        value: value,
      };
      // if the element has value, then add it
      if (["radio", "checkbox"].includes(e.target.nodeName.toLowerCase())) {
        sendObj["value"] = e.target.value ? e.target.value : "";
      }

      // console.log("sendObj", sendObj);

      this.sendMessage(sendObj);
    }
  };

  /**
   * @param {event} e - `element object`
   * @param {object} type - `event type`
   * @param {Element} direct - if element is given, then use it directly, else get the element from event object
   * @returns `void` - nothing
   * @description format the event and element data and send it to background script
   */
  recordStep = async (e, type, direct, value, frame, xpath) => {
    _error("XPATH");
    console.log("send xpath -------", xpath);

    let grid_data = xpath.selected_grid_data;
    xpath = await filterxpath(xpath.locators);

    const sendObject = await collectProps(e, type, direct, xpath, grid_data);
    // const frameObject = await collectProps(frame, "frame", direct)

    _info("sendObject");
    //if there any drag & drop element found
    if (sendObject["action"] === "dragStartObject") {
      sendObject["action"] = "DRAG";
    } else if (sendObject["action"] === "dragAndDropToObject") {
      sendObject["action"] = "DROP";
    }
    console.log(sendObject);

    if (
      sendObject.attributes.id !== "overlay-ele" &&
      sendObject.attributes.id !== "validation-div" &&
      sendObject.attributes.id !== "validation-dropdown" &&
      sendObject.attributes.id !== "validation-action-row" &&
      sendObject.attributes.id !== "validation-action-label" &&
      sendObject.attributes.id !== "validation-action-showdetails" &&
      sendObject.attributes.id !== "valiadtion-contain-text-header" &&
      sendObject.attributes.id !== "validation-contains-input-text" &&
      sendObject.attributes.id !== "validation-action-row-element" &&
      sendObject.attributes.id !== "validation-save-step-button-container" &&
      sendObject.attributes.id !== "validation-save-step-button"
    ) {
      await this.sendUpdate(e, type, sendObject, value, frame);
    }

    // send the collected data to background script
  };

  /**
   * @description inject event listeners in the page
   */
  start = () => {
    let keysPressed = {};
    // last argument "true" is for useCapture flag.
    // more: https://stackoverflow.com/questions/29922682/onclick-priority-over-addeventlistener-in-javascript

    // click events
    // window.document.addEventListener("click", this.leftClickEvent, true);
    // window.document.addEventListener("contextmenu", this.contextMenuEvent, true);
    // window.document.addEventListener("dblclick", this.doubleClickEvent, true);
    // // for the input and textarea
    // window.document.addEventListener("focusout", this.onBlur, true);
    // window.document.addEventListener("keydown", this.onKeyDown, true);
    // // for dropdown
    // window.document.addEventListener("change", this.onchangeEvent, true);
    // // drag - drop
    // window.document.addEventListener("dragstart", this.onDragEvent, true);
    // window.document.addEventListener("drop", this.onDropEvent, true);
    document.addEventListener("click", this.getData);
    document.addEventListener("mouseover", this.draw);
    window.document.addEventListener("mouseover", this.onmouseoverevent, true);
    window.document.addEventListener("mouseout", this.onMouseOutEvent, true);
    window.document.addEventListener("mousemove", this.onMouseMoveEvent, true);
    // window.document.addEventListener("dblclick", this.showValidationList);
    document.addEventListener("keydown", (event) => {
      console.log("keydown event trigger", event);
      keysPressed[event.key] = true;

      if (keysPressed["Control"] && event.key === "b") {
        console.log("----------------->", event.key);
        this.showValidationList(event, "show");
      }
    });
    document.addEventListener("keyup", (event) => {
      console.log("key up---------->");
      delete keysPressed[event.key];
    });
  };

  /**
   * @description try to remove event listeners from page on start
   */
  remove = () => {
    // window.document.removeEventListener("click", this.leftClickEvent);
    // window.document.removeEventListener("contextmenu", this.contextMenuEvent);
    // window.document.removeEventListener("dblclick", this.doubleClickEvent);
    // window.document.removeEventListener("focusout", this.onBlur);
    // window.document.removeEventListener("keydown", this.onKeyDown);
    // window.document.removeEventListener("change", this.onchangeEvent);
    // window.document.removeEventListener("dragstart", this.onDragEvent);
    // window.document.removeEventListener("drop", this.onDropEvent);
    document.removeEventListener("mouseover", this.draw);
    window.document.removeEventListener("mouseover", this.onmouseoverevent);
    window.document.removeEventListener("mouseout", this.onMouseOutEvent);
    window.document.removeEventListener("mousemove", this.onMouseMoveEvent);
    // window.document.addEventListener("dblclick", this.showValidationList);
  };

  // This part of code is copyright by Software Freedom Conservancy(SFC)
  parseEventKey(eventKey) {
    if (eventKey.match(/^C_/)) {
      return { eventName: eventKey.substring(2), capture: true };
    } else {
      return { eventName: eventKey, capture: false };
    }
  }

  // This part of code is copyright by Software Freedom Conservancy(SFC)
  attach() {
    console.log("came to attach function----------------------");

    if (attached) {
      return;
    }
    attached = true;

    this.start();
    this.eventListeners = {};
    var self = this;
    for (let eventKey in EventRecorder.eventHandlers) {
      var eventInfo = this.parseEventKey(eventKey);
      var eventName = eventInfo.eventName;
      var capture = eventInfo.capture;
      // create new function so that the variables have new scope.
      function register() {
        var handlers = EventRecorder.eventHandlers[eventKey];
        var listener = function (event) {
          for (var i = 0; i < handlers.length; i++) {
            handlers[i].call(self, event);
          }
        };
        this.window.document.addEventListener(eventName, listener, capture);
        this.eventListeners[eventKey] = listener;
      }
      register.call(this);
    }
  }

  // This part of code is copyright by Software Freedom Conservancy(SFC)
  detach() {
    if (!attached) {
      return;
    }
    this.remove();
    attached = false;
    for (let eventKey in this.eventListeners) {
      var eventInfo = this.parseEventKey(eventKey);
      var eventName = eventInfo.eventName;
      var capture = eventInfo.capture;
      this.window.document.removeEventListener(eventName, this.eventListeners[eventKey], capture);
    }
    delete this.eventListeners;
  }

  getFrameLocation() {
    let currentWindow = window;
    let currentParentWindow;
    let frameLocation = "";
    let framelocationelement;
    while (currentWindow !== window.top) {
      currentParentWindow = currentWindow.parent;
      for (let idx = 0; idx < currentParentWindow.frames.length; idx++)
        if (currentParentWindow.frames[idx] === currentWindow) {
          frameLocation = ":" + idx + frameLocation;
          currentWindow = currentParentWindow;
          break;
        }

      // framelocationelement = currentWindow.document.activeElement
    }
    return { frameLocation: "root" + frameLocation, framelocationelement: framelocationelement };
  }

  record(event, command, target, value, insertBeforeLastCommand, actualFrameLocation) {
    console.log("event.target --------->", event.target.value);
    console.log("locators builder ----------->", this.locatorBuilders.buildAll(event.target));

    let self = this;

    console.log("Got message to record");
    let result = {
      type: "RECORD_POST",
      event: event,
      action: command,
      props: target,
      value: value,
      insertBeforeLastCommand: insertBeforeLastCommand,
      frameLocation: actualFrameLocation != undefined ? actualFrameLocation : this.frameLocation,
      // framelocationelement: this.framelocationelement
    };
    console.log(result);

    // let values = this.getFrameLocation()
    // this.frameLocation = values.frameLocation
    // this.framelocationelement = values.framelocationelement

    // console.log(values);

    this.recordStep(event, command, null, value, this.frameLocation, target);

    // chrome.runtime.sendMessage(result)
  }
}

EventRecorder.eventHandlers = {};
EventRecorder.addEventHandler = function (handlerName, eventName, handler, options) {
  handler.handlerName = handlerName;
  if (!options) options = false;
  let key = options ? "C_" + eventName : eventName;
  if (!this.eventHandlers[key]) {
    this.eventHandlers[key] = [];
  }
  this.eventHandlers[key].push(handler);
};

/**
 * on load, send message to background script
 * background script verify the source
 * it the source is recording tab,
 * then it will send "START_RECORDING" action to inject the event listeners
 */
window.addEventListener("load", function load(event) {
  eR = new EventRecorder(window);
  // eR.remove()
  chrome.runtime.sendMessage({ type: "RECORD_PING" });
});

/**
 * get a action message from background js and perform
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  _info("- RECORD - Received Message from Background -");
  console.log(message);

  if (message.action === "START_RECORDING") {
    console.log("came to start attach ---------------");
    // eR.remove()
    eR.attach();
  } else if (message.action === "RECORD_ANCHOR") {
    ANCHOR_MODE = true;
    eR.addAnchorCursor();
  } else if (message.action === "RELOAD_MADI") {
    location.reload();
  } else if (message.action === "RECORD_GRID") {
    GRID_MODE = true;
  }
});

/////// Recorder Handler------------
var typeTarget;
var typeLock = 0;
EventRecorder.inputTypes = ["text", "password", "file", "checkbox", "datetime", "datetime-local", "date", "month", "time", "week", "number", "range", "email", "url", "search", "tel", "color"];
EventRecorder.addEventHandler("type", "change", function (event) {
  // © Chen-Chieh Ping, SideeX Team

  if (event.target.tagName && !preventType && typeLock == 0 && (typeLock = 1)) {
    // END
    var tagName = event.target.tagName.toLowerCase();
    var type = event.target.type;

    if ("input" == tagName && EventRecorder.inputTypes.indexOf(type) >= 0) {
      if (event.target.value.length > 0) {
        if (type === "file") {
          _error("FILE EVENT");
          console.log(event);

          let lbe = this.locatorBuilders.buildAll(event.target);
          this.record(event, "FILEUPLOAD", lbe, event.target.value);
        } else {
          this.record(event, "KEY", this.locatorBuilders.buildAll(event.target), event.target.value);
        }

        // © Chen-Chieh Ping, SideeX Team
        // if (enterTarget != null) {
        //   var tempTarget = event.target.parentElement;
        //   var formChk = tempTarget.tagName.toLowerCase();
        //   while (formChk != "form" && formChk != "body") {
        //     tempTarget = tempTarget.parentElement;
        //     formChk = tempTarget.tagName.toLowerCase();
        //   }
        //   if (formChk == "form" && (tempTarget.hasAttribute("id") || tempTarget.hasAttribute("name")) && !tempTarget.hasAttribute("onsubmit")) {
        //     if (tempTarget.hasAttribute("id")) this.record(event, "MOUSELCLICK", [["id=" + tempTarget.id, "id"]], "");
        //     else if (tempTarget.hasAttribute("name")) this.record(event, "MOUSELCLICK", [["name=" + tempTarget.name, "name"]], "");
        //   } else this.record(event, "KEY", this.locatorBuilders.buildAll(enterTarget), "${KEY_ENTER}");
        //   enterTarget = null;
        // }
        // END
      } else {
        if (type === "checkbox") {
          this.record(event, "MOUSELCLICK", this.locatorBuilders.buildAll(event.target), "");
        } else {
          this.record(event, "KEY", this.locatorBuilders.buildAll(event.target), event.target.value);
        }
      }
    } else if ("textarea" == tagName) {
      this.record(event, "KEY", this.locatorBuilders.buildAll(event.target), event.target.value);
    }
  }
  typeLock = 0;
});

EventRecorder.addEventHandler("type", "input", function (event) {
  //console.log(event.target);
  typeTarget = event.target;
});

// © Jie-Lin You, SideeX Team
var preventClickTwice = false;
EventRecorder.addEventHandler(
  "clickAt",
  "click",
  function (event) {
    if (event.button == 0 && event.isTrusted) {
      if (!preventClickTwice) {
        var top = event.pageY,
          left = event.pageX,
          found_file = false,
          file_element = null;
        var element = event.target;
        preventClick = true;
        // do {
        //   let input_eles = element.getElementsByTagName("input");

        //   if (input_eles && input_eles.length > 0) {
        //     for (const input of input_eles) {
        //       if (input.type == "file") {
        //         found_file = true;
        //         file_element = input;
        //         break;
        //       }
        //     }
        //     if (found_file) {
        //       break;
        //     }
        //   }

        //   top -= element.offsetTop;
        //   left -= element.offsetLeft;
        //   element = element.offsetParent;
        //   console.log(element);
        // } while (element);
        // var target = event.target;

        if (found_file) {
          // this.record(file_element, "FILEUPLOAD", this.locatorBuilders.buildAll(file_element), "");
          this.record(event, "MOUSELCLICK", this.locatorBuilders.buildAll(event.target), "");
        } else {
          this.record(event, "MOUSELCLICK", this.locatorBuilders.buildAll(event.target), "");
        }

        // var arrayTest = this.locatorBuilders.buildAll(event.target);
        console.log("from click");

        this.clickLocator = true;
        preventClickTwice = true;
        setTimeout(function () {
          preventClick = false;
        }, 200);
      }
      setTimeout(function () {
        preventClickTwice = false;
      }, 30);
    }
  },
  true
);
// END

// © Chen-Chieh Ping, SideeX Team
EventRecorder.addEventHandler(
  "doubleClickAt",
  "dblclick",
  function (event) {
    var top = event.pageY,
      left = event.pageX;
    var element = event.target;
    do {
      top -= element.offsetTop;
      left -= element.offsetLeft;
      element = element.offsetParent;
    } while (element);
    this.record(event, "MOUSEDCLICK", this.locatorBuilders.buildAll(event.target), "");
  },
  true
);
// END

// © Chen-Chieh Ping, SideeX Team
var focusTarget = null;
var focusValue = null;
var tempValue = null;
var preventType = false;
var inp = document.getElementsByTagName("input");
for (var i = 0; i < inp.length; i++) {
  if (EventRecorder.inputTypes.indexOf(inp[i].type) >= 0) {
    inp[i].addEventListener("focus", function (event) {
      focusTarget = event.target;
      focusValue = focusTarget.value;
      tempValue = focusValue;
      preventType = false;
    });
    inp[i].addEventListener("blur", function (event) {
      focusTarget = null;
      focusValue = null;
      tempValue = null;
    });
  }
}
// END

// © Chen-Chieh Ping, SideeX Team
var preventClick = false;
var enterTarget = null;
EventRecorder.addEventHandler(
  "sendKeys",
  "keydown",
  function (event) {
    if (event.target.tagName) {
      var key = event.keyCode;
      var tagName = event.target.tagName.toLowerCase();
      var type = event.target.type;

      if (tagName == "input" && EventRecorder.inputTypes.indexOf(type) >= 0) {
        enterTarget = event.target;
        if (key == 13) {
          // if (enterTarget.value ) {
          //   this.record(event,"KEY", this.locatorBuilders.buildAll(enterTarget), enterTarget.value);
          //   enterTarget = null;
          //   preventType = true;
          // }
          setTimeout(
            function () {
              if (!preventClick) {
                this.record(event, "KEY", this.locatorBuilders.buildAll(enterTarget), "${KEY_ENTER}");
              }
            }.bind(this),
            100
          );
          // preventClick = true;
          // setTimeout(function() {
          //     preventClick = false;
          // }, 200);
        }
        if (key == 38 || key == 40) {
          if (key == 38) this.record(event, "KEY", this.locatorBuilders.buildAll(event.target), "${KEY_UP}");
          else this.record(event, "KEY", this.locatorBuilders.buildAll(event.target), "${KEY_DOWN}");
        }
        if (key == 9) {
          // if (enterTarget.value ) {
          //   this.record(event,"KEY", this.locatorBuilders.buildAll(enterTarget), enterTarget.value);
          //   enterTarget = null;
          //   preventType = true;
          // }
          setTimeout(
            function () {
              this.record(event, "KEY", this.locatorBuilders.buildAll(event.target), "${KEY_TAB}");
            }.bind(this),
            200
          );
        }
        if (key == 27) {
          // if (enterTarget.value ) {
          //   this.record(event,"KEY", this.locatorBuilders.buildAll(enterTarget), enterTarget.value);
          //   enterTarget = null;
          //   preventType = true;
          // }
          setTimeout(
            function () {
              this.record(event, "KEY", this.locatorBuilders.buildAll(event.target), "${KEY_ESC}");
            }.bind(this),
            200
          );
        }
      }
    }
    enterTarget = null;
    preventType = false;
  },
  true
);
// END

// © Shuo-Heng Shih, SideeX Team
EventRecorder.addEventHandler(
  "dragAndDrop",
  "mousedown",
  function (event) {
    console.log("mousedown", event.target);
    if (
      event.target.id !== "validation-div" &&
      event.target.id !== "validation-dropdown" &&
      event.target.id !== "validation-action-row" &&
      event.target.id !== "validation-action-label" &&
      event.target.id !== "validation-action-showdetails" &&
      event.target.id !== "valiadtion-contain-text-header" &&
      event.target.id !== "validation-contains-input-text" &&
      event.target.id !== "validation-action-row-element" &&
      event.target.id !== "validation-save-step-button-container"
      // event.target.id !== "validation-save-step-button"
    ) {
      let element = document.getElementById("validation-div");
      let overlay_element = document.getElementById("overlay-ele");
      if (element) {
        if (event.target.id === "validation-save-step-button") {
          setTimeout(function () {
            element.remove();
            overlay_element.remove();
          }, 3000);
        } else {
          element.remove();
          overlay_element.remove();
        }
      }
    }

    console.log(event);

    var self = this;
    if (event.clientX < window.document.documentElement.clientWidth && event.clientY < window.document.documentElement.clientHeight) {
      this.mousedown = event;
      this.mouseup = setTimeout(
        function () {
          delete self.mousedown;
        }.bind(this),
        200
      );

      this.selectMouseup = setTimeout(
        function () {
          self.selectMousedown = event;
        }.bind(this),
        200
      );
    }
    this.mouseoverQ = [];

    if (event.target.nodeName) {
      var tagName = event.target.nodeName.toLowerCase();
      if ("option" == tagName) {
        var parent = event.target.parentNode;
        if (parent.multiple) {
          var options = parent.options;
          for (var i = 0; i < options.length; i++) {
            options[i]._wasSelected = options[i].selected;
          }
        }
      }
    }
  },
  true
);
// END

// © Shuo-Heng Shih, SideeX Team
EventRecorder.addEventHandler(
  "dragAndDrop",
  "mouseup",
  function (event) {
    console.log("mouseup");
    console.log(event);

    clearTimeout(this.selectMouseup);
    if (this.selectMousedown) {
      var x = event.clientX - this.selectMousedown.clientX;
      var y = event.clientY - this.selectMousedown.clientY;

      function getSelectionText() {
        var text = "";
        var activeEl = window.document.activeElement;
        var activeElTagName = activeEl ? activeEl.tagName.toLowerCase() : null;
        if (activeElTagName == "textarea" || activeElTagName == "input") {
          text = activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd);
        } else if (window.getSelection) {
          text = window.getSelection().toString();
        }
        return text.trim();
      }

      if (
        this.selectMousedown &&
        event.button === 0 &&
        x + y &&
        event.clientX < window.document.documentElement.clientWidth &&
        event.clientY < window.document.documentElement.clientHeight &&
        getSelectionText() === ""
      ) {
        var sourceRelateX = this.selectMousedown.pageX - this.selectMousedown.target.getBoundingClientRect().left - window.scrollX;
        var sourceRelateY = this.selectMousedown.pageY - this.selectMousedown.target.getBoundingClientRect().top - window.scrollY;
        var targetRelateX, targetRelateY;
        if (!!this.mouseoverQ.length && this.mouseoverQ[1].relatedTarget == this.mouseoverQ[0].target && this.mouseoverQ[0].target == event.target) {
          targetRelateX = event.pageX - this.mouseoverQ[1].target.getBoundingClientRect().left - window.scrollX;
          targetRelateY = event.pageY - this.mouseoverQ[1].target.getBoundingClientRect().top - window.scrollY;
          this.record(event, "mouseDownAt", this.locatorBuilders.buildAll(this.selectMousedown.target), sourceRelateX + "," + sourceRelateY);
          this.record(event, "mouseMoveAt", this.locatorBuilders.buildAll(this.mouseoverQ[1].target), targetRelateX + "," + targetRelateY);
          this.record(event, "mouseUpAt", this.locatorBuilders.buildAll(this.mouseoverQ[1].target), targetRelateX + "," + targetRelateY);
        } else {
          targetRelateX = event.pageX - event.target.getBoundingClientRect().left - window.scrollX;
          targetRelateY = event.pageY - event.target.getBoundingClientRect().top - window.scrollY;
          this.record(event, "mouseDownAt", this.locatorBuilders.buildAll(event.target), targetRelateX + "," + targetRelateY);
          this.record(event, "mouseMoveAt", this.locatorBuilders.buildAll(event.target), targetRelateX + "," + targetRelateY);
          this.record(event, "mouseUpAt", this.locatorBuilders.buildAll(event.target), targetRelateX + "," + targetRelateY);
        }
      }
    } else {
      if (this.mousedown) {
        var x = event.clientX - this.mousedown.clientX;
        var y = event.clientY - this.mousedown.clientY;

        if (this.mousedown && this.mousedown.target !== event.target && !(x + y)) {
          this.record(event, "mouseDown", this.locatorBuilders.buildAll(this.mousedown.target), "");
          this.record(event, "mouseUp", this.locatorBuilders.buildAll(event.target), "");
        } else if (this.mousedown && this.mousedown.target === event.target) {
          var self = this;
          var target = this.locatorBuilders.buildAll(this.mousedown.target);
          console.log("from mouseup");

          setTimeout(
            function () {
              if (!self.clickLocator) this.record(event, "MOUSELCLICK", target, "");
            }.bind(this),
            100
          );
        }
        delete this.clickLocator;
        delete this.mouseup;
      }
    }
    delete this.mousedown;
    delete this.selectMousedown;
    delete this.mouseoverQ;
  },
  true
);
// END

// © Shuo-Heng Shih, SideeX Team
EventRecorder.addEventHandler(
  "dragAndDropToObject",
  "dragstart",
  function (event) {
    console.log("dragstart.....", event);
    this.record(event, "dragStartObject", this.locatorBuilders.buildAll(event.target), "");
    var self = this;
    this.dropLocator = setTimeout(
      function () {
        self.dragstartLocator = event;
      }.bind(this),
      200
    );
  },
  true
);
// END

// © Shuo-Heng Shih, SideeX Team
EventRecorder.addEventHandler(
  "dragAndDropToObject",
  "drop",
  function (event) {
    console.log("ondrop .....", event);

    clearTimeout(this.dropLocator);

    if (this.dragstartLocator && event.button == 0 && this.dragstartLocator.target !== event.target) {
      //value no option
      this.record(event, "dragAndDropToObject", this.locatorBuilders.buildAll(this.dragstartLocator.target), this.locatorBuilders.build(event.target));
    }
    delete this.dragstartLocator;
    delete this.selectMousedown;
  },
  true
);
// END

// © Shuo-Heng Shih, SideeX Team
var prevTimeOut = null;
EventRecorder.addEventHandler(
  "runScript",
  "scroll",
  function (event) {
    if (pageLoaded === true) {
      var self = this;
      this.scrollDetector = event.target;
      clearTimeout(prevTimeOut);
      prevTimeOut = setTimeout(
        function () {
          delete self.scrollDetector;
        }.bind(self),
        500
      );
    }
  },
  true
);
// END

// © Shuo-Heng Shih, SideeX Team
var nowNode = 0;
// ---------- EXTRA HOVER EVENT HANDLER------------------------
// EventRecorder.addEventHandler(
//   "mouseOver",
//   "mouseover",
//   function(event) {
//     // _error("MOUSEOVER")
//     // console.log(event);
//     event.target.style.outline = "1px dotted #333 !important";

//     if (window.document.documentElement) nowNode = window.document.documentElement.getElementsByTagName("*").length;
//     var self = this;
//     if (pageLoaded === true) {
//       this.mouseoverelement = event;
//       var clickable = this.findClickableElement(event.target);
//       // console.log("is element clickableeeeeeeeeeeee---------->", clickable);

//       if (clickable) {
//         this.nodeInsertedLocator = event.target;
//         setTimeout(
//           function() {
//             delete self.nodeInsertedLocator;
//           }.bind(self),
//           500
//         );

//         this.nodeAttrChange = this.locatorBuilders.buildAll(event.target);
//         this.nodeAttrChangeTimeout = setTimeout(
//           function() {
//             delete self.nodeAttrChange;
//           }.bind(self),
//           10
//         );
//       }
//       //drop target overlapping
//       if (this.mouseoverQ) {
//         //mouse keep down
//         if (this.mouseoverQ.length >= 3) this.mouseoverQ.shift();
//         this.mouseoverQ.push(event);
//       }
//     }
//   },
//   true
// );
// END

// © Shuo-Heng Shih, SideeX Team
EventRecorder.addEventHandler(
  "mouseOut",
  "mouseout",
  function (event) {
    // _info("MOUSEOUT")
    // event.target.style.outline = "0px";
    if (this.mouseoutLocator !== null && event.target === this.mouseoutLocator) {
      // this.record(event,"mouseOut", this.locatorBuilders.buildAll(event.target), '');
    }
    delete this.mouseoutLocator;
  },
  true
);
// END

// © Shuo-Heng Shih, SideeX Team
EventRecorder.addEventHandler(
  "mouseOver",
  "DOMNodeInserted",
  function (event) {
    // _error("DOMNodeInserted")
    // console.log(event);
    if (pageLoaded === true && window.document.documentElement.getElementsByTagName("*").length > nowNode) {
      var self = this;
      if (this.scrollDetector) {
        //TODO: fix target
        // this.record(event,"runScript", [
        //     [
        //         ["window.scrollTo(0," + window.scrollY + ")", ]
        //     ]
        // ], '');
        pageLoaded = false;
        setTimeout(
          function () {
            pageLoaded = true;
          }.bind(self),
          550
        );
        delete this.scrollDetector;
        delete this.nodeInsertedLocator;
      }
      if (this.nodeInsertedLocator) {
        // console.log("recorded");
        // console.log(this.mouseoverelement);

        this.record(this.mouseoverelement, "mouseOver", this.locatorBuilders.buildAll(this.mouseoverelement), "");
        this.mouseoutLocator = this.nodeInsertedLocator;
        delete this.nodeInsertedLocator;
        delete this.mouseoverLocator;
      }
    }
  },
  true
);
// END

EventRecorder.addEventHandler(
  "DOMAttrModified",
  "DOMAttrModified",
  function (event) {
    _error("DOMAttrModified");
    console.log(event);
  },
  true
);

// © Shuo-Heng Shih, SideeX Team
var readyTimeOut = null;
var pageLoaded = true;
EventRecorder.addEventHandler(
  "checkPageLoaded",
  "readystatechange",
  function (event) {
    var self = this;
    if (window.document.readyState === "loading") {
      pageLoaded = false;
    } else {
      pageLoaded = false;
      clearTimeout(readyTimeOut);
      readyTimeOut = setTimeout(
        function () {
          pageLoaded = true;
        }.bind(self),
        1500
      ); //setReady after complete 1.5s
    }
  },
  true
);
// END

// © Ming-Hung Hsu, SideeX Team
EventRecorder.addEventHandler(
  "contextMenu",
  "contextmenu",
  function (event) {
    var myPort = chrome.runtime.connect();
    var tmpText = this.locatorBuilders.buildAll(event.target);
    var tmpVal = getText(event.target);
    var tmpTitle = normalizeSpaces(event.target.ownerDocument.title);
    var self = this;
    myPort.onMessage.addListener(function portListener(m) {
      if (m.cmd.includes("Text")) {
        self.record(m.cmd, tmpText, tmpVal);
      } else if (m.cmd.includes("Title")) {
        self.record(m.cmd, [[tmpTitle]], "");
      } else if (m.cmd.includes("Value")) {
        self.record(m.cmd, tmpText, getInputValue(event.target));
      }
      myPort.onMessage.removeListener(portListener);
    });
  },
  true
);
// END

// © Yun-Wen Lin, SideeX Team
var getEle;
var checkFocus = 0;
EventRecorder.addEventHandler(
  "editContent",
  "focus",
  function (event) {
    var editable = event.target.contentEditable;
    if (editable == "true") {
      getEle = event.target;
      contentTest = getEle.innerHTML;
      checkFocus = 1;
    }
  },
  true
);
// END

// © Yun-Wen Lin, SideeX Team
EventRecorder.addEventHandler(
  "editContent",
  "blur",
  function (event) {
    if (checkFocus == 1) {
      if (event.target == getEle) {
        if (getEle.innerHTML != contentTest) {
          this.record(event, "MOUSERCLICK", this.locatorBuilders.buildAll(event.target), getEle.innerHTML);
        }
        checkFocus = 0;
      }
    }
  },
  true
);
// END

chrome.runtime.sendMessage({
  attachRecorderRequest: true,
});

// Copyright 2005 Shinya Kasatani
EventRecorder.prototype.getOptionLocator = function (option) {
  var label = option.text.replace(/^ *(.*?) *$/, "$1");
  if (label.match(/\xA0/)) {
    // if the text contains &nbsp;
    return (
      "label=regexp:" +
      label
        .replace(/[\(\)\[\]\\\^\$\*\+\?\.\|\{\}]/g, function (str) {
          return "\\" + str;
        })
        .replace(/\s+/g, function (str) {
          if (str.match(/\xA0/)) {
            if (str.length > 1) {
              return "\\s+";
            } else {
              return "\\s";
            }
          } else {
            return str;
          }
        })
    );
  } else {
    return "label=" + label;
  }
};

EventRecorder.prototype.findClickableElement = function (e) {
  if (!e.tagName) return null;
  var tagName = e.tagName.toLowerCase();
  var type = e.type;
  if (
    e.hasAttribute("onclick") ||
    e.hasAttribute("href") ||
    tagName == "button" ||
    (tagName == "input" && (type == "submit" || type == "button" || type == "image" || type == "radio" || type == "checkbox" || type == "reset"))
  ) {
    return e;
  } else {
    // console.log("find clickable element ------------------->");

    if (e.parentNode != null) {
      return this.findClickableElement(e.parentNode);
    } else {
      return null;
    }
  }
};

//select / addSelect / removeSelect
EventRecorder.addEventHandler(
  "select",
  "focus",
  function (event) {
    console.log(event);

    if (event.target.nodeName) {
      var tagName = event.target.nodeName.toLowerCase();
      if ("select" == tagName && event.target.multiple) {
        var options = event.target.options;
        for (var i = 0; i < options.length; i++) {
          if (options[i]._wasSelected == null) {
            // is the focus was gained by mousedown event, _wasSelected would be already set
            options[i]._wasSelected = options[i].selected;
          }
        }
      }
    }
  },
  true
);

EventRecorder.addEventHandler("select", "change", function (event) {
  console.log("select------------->", event);

  if (event.target.tagName) {
    var tagName = event.target.tagName.toLowerCase();
    if ("select" == tagName) {
      if (!event.target.multiple) {
        console.log("this is dropdown event------------->", tagName);
        var option = event.target.options[event.target.selectedIndex];
        this.record(event, "DROPDOWN", this.locatorBuilders.buildAll(event.target), this.getOptionLocator(option));
      } else {
        var options = event.target.options;
        for (var i = 0; i < options.length; i++) {
          if (options[i]._wasSelected == null) {
          }
          if (options[i]._wasSelected != options[i].selected) {
            var value = this.getOptionLocator(options[i]);
            if (options[i].selected) {
              this.record(event, "addSelection", this.locatorBuilders.buildAll(event.target), value);
            } else {
              this.record(event, "removeSelection", this.locatorBuilders.buildAll(event.target), value);
            }
            options[i]._wasSelected = options[i].selected;
          }
        }
      }
    }
  }
});
