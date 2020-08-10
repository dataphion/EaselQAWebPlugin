import { _error, _warning, _info } from "../background/helperFunctions";
// sideex lib to extract all possible paths to get the element
import { LocatorBuilders } from "./locator-builders";
const locatorBuilders = new LocatorBuilders(window);

/**
 * @param  {object} e
 * @description get all possible attributes from node
 */
export const collectAttributes = function(element) {
  return new Promise((resolve, reject) => {
    try {
      const attributes = {};
      for (var att, i = 0, atts = element.attributes, n = atts.length; i < n; i++) {
        att = atts[i];
        attributes[att.nodeName] = att.nodeValue;
      }
      resolve(attributes);
    } catch (error) {
      _error("error in collectAttributes");
      console.error(error);
      reject(error);
    }
  });
};

const xpath = function(element) {
  // _error("ELEMENT_PARENTNODE")
  // console.log(element);

  if (typeof element == "string") return document.evaluate(element, document, null, 0, null);
  if (!element || element.nodeType != 1) return "";
  if (element.id) return "//*[@id='" + element.id + "']";
  var sames = [];
  if (element.parentNode) {
    sames = [].filter.call(element.parentNode.children, function(x) {
      return x.tagName == element.tagName;
    });
    return xpath(element.parentNode) + "/" + element.tagName.toLowerCase() + (sames.length > 1 ? "[" + ([].indexOf.call(sames, element) + 1) + "]" : "");
  } else {
    return "";
    // sames = document.getElementsByTagName(element.tagName)
    // _error("SAMES")
    // console.log(sames);
    // return '//' + element.tagName.toLowerCase() + (sames.length > 0 ? '['+([].indexOf.call(sames, element)+1)+']' : '')
  }
};

/**
 * @param  {node} element
 * @description get the ways to find the element from relative and absolute xpaths
 */
export const collectPaths = function(element, xpathh) {
  return new Promise((resolve, reject) => {
    try {
      // _error("XPATHHH")
      // console.log(xpathh);

      let element_props = xpathh ? xpathh : [];
      let xpath_val = xpath(element);
      // element_props = locatorBuilders.buildAll(element)
      if (xpath_val && xpathh) {
        if (xpathh.indexOf(xpath_val) === -1) {
          xpathh.push(xpath_val);
        }
      }
      resolve(element_props);
    } catch (error) {
      _error("error in collectPaths");
      console.error(error);
      reject(error);
    }
  });
};

/**
 * @param  {node} element
 * @param  {string} type
 * @param  {object} attributes
 * @param  {Array} paths
 * @param  {String} level
 * @description prepare the data
 */
export const prepareProps = function(element, type, attributes, paths, level) {
  return new Promise((resolve, reject) => {
    try {
      const props = {
        pixel_ratio: window.devicePixelRatio,
        element_props: paths,
        attributes: attributes,
        x_scroll: window.pageXOffset,
        y_scroll: window.pageYOffset,
        browser_height: window.innerWidth,
        browser_width: window.innerHeight
      };

      if (level === "grandparent") {
        props.type = element.nodeName.toLowerCase();
        props.text = element.innerText;
        const offsets = getOffset(element);
        props.height = offsets.height;
        props.width = offsets.width;
        props.clientX = offsets.left;
        props.clientY = offsets.top;
      } else if (level === "parent") {
        props.type = element.nodeName.toLowerCase();
        props.text = element.innerText;
        const offsets = getOffset(element);
        props.height = offsets.height;
        props.width = offsets.width;
        props.clientX = offsets.left;
        props.clientY = offsets.top;
      } else {
        // the problem will come when span/div is inside the button
        // while execution, the event will get triggered
        // on the span/div instead of the 'real' button
        if (element.parentNode && element.parentNode.nodeName.toLowerCase() === "button") {
          props.type = "button";
        } else {
          let e_type = element.nodeName.toLowerCase();
          props.type = e_type;

          // if present, store the labels for a given input
          if (e_type === "input") {
            if (element.labels && element.labels[0]) {
              props.element_label = element.labels[0].innerText;
            }
          }
        }
        props.text = element.innerText;
        const offsets = getOffset(element);
        // const offset = cumulativeOffset(element)
        // console.log(offset);
        // console.log(offsets);

        // props.test = offset
        props.height = offsets.height;
        props.width = offsets.width;
        props.clientX = offsets.left;
        props.clientY = offsets.top;
      }

      // url data
      const paramsObj = new URLSearchParams(window.location.search);
      const query_parameters = {};
      for (let value of paramsObj.keys()) {
        query_parameters[value] = paramsObj.get(value);
      }
      props.url = window.location.href;
      props.action = type;
      props.domain = window.location.hostname;
      props.protocol = window.location.protocol;
      props.path = window.location.pathname;
      props.query_parameters = query_parameters;

      resolve(props);
    } catch (error) {
      _error("error in prepareProps");
      console.error(error);
      reject(error);
    }
  });
};

export const filterxpath = async function(xpath) {
  console.log("xpath filters -------------->", xpath);

  function checker(value) {
    console.log(value);

    let prohibited = ["id", "name", "css", "class"];
    for (var i = 0; i < prohibited.length; i++) {
      // if (value[1] === prohibited[i] || value[0].includes("xpath=(")) {
      if (value[1] === prohibited[i]) {
        return false;
      }
    }
    return true;
  }
  // console.log(xpath);
  let x = [];
  for (const xpa of xpath) {
    // _error("XPATH")
    console.log("xpa------------------>", xpa);
    console.log(xpa[1]);

    let test = xpa[1] === "" ? true : checker(xpa);
    let x_path = "";
    if (xpa[0].includes("xpath=")) {
      x_path = xpa[0].trim().replace("xpath=", "");
    } else {
      x_path = xpa[0];
    }
    test ? x.push(x_path) : "";
    // _error("REFINED XPATH")
    // console.log(test);
  }
  return x;
};

/**
 * @param {event} e - `element object`
 * @param {object} type - `event type`
 * @param {Element} direct - if element is given, then use it directly, else get the element from event object
 * @returns `void` - nothing
 * @description format the event and element data and send it to background script
 */
export const collectProps = async function(e, type, direct, xpath, grid_data) {
  // main element attributes
  // console.log(e);
  console.log("make props =========>", xpath, "grid data --->", grid_data);

  const main_elt = direct ? direct : e.target ? e.target : e;
  // console.log(main_elt);

  const attributes = await collectAttributes(main_elt);
  const paths = await collectPaths(main_elt, xpath);
  const props = await prepareProps(main_elt, type, attributes, paths);

  // parent attributes
  const parent_elt = main_elt.parentNode;
  if (parent_elt) {
    const parent_attributes = await collectAttributes(parent_elt);
    const parent_paths = await collectPaths(parent_elt);
    const parent_props = await prepareProps(parent_elt, type, parent_attributes, parent_paths, "parent");
    props["parent_clientX"] = parent_props["clientX"];
    props["parent_clientY"] = parent_props["clientY"];
    props["parent_attributes"] = parent_attributes;
    props["gird_row"] = grid_data;

    /* grand parent attributes
		const grand_parent_elt = main_elt.parentNode.parentNode
		if (grand_parent_elt) {
			const grand_attributes = await collectAttributes(grand_parent_elt)
			const grand_paths = await collectPaths(grand_parent_elt)
			const grand_props = await prepareProps(grand_parent_elt, type, grand_attributes, grand_paths, "grandparent")
			sendObject["parent_props_level_2"] = grand_props
		}
		*/
  }

  // send the collected data to background script
  return props;
};

/**
 * @param {object} element - `element object`
 * @returns {object} location values
 * @description get the boundaries of the element
 */
export const getOffset = function(el) {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    leftCenter: rect.left + rect.width / 2,
    topCenter: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
    x: rect.x,
    y: rect.y
  };
};

export const cumulativeOffset = function(element) {
  const top = 0,
    left = 0;
  do {
    top += element.offsetTop || 0;
    left += element.offsetLeft || 0;
    element = element.offsetParent;
  } while (element);

  return {
    top: top,
    left: left
  };
};

/**
 * @param {object} element - `element object`
 * @returns {object} location values
 * @description get the boundaries of the element
 */
export const mergeIds = async function(old_props, props) {
  // console.log(old_props);
  // console.log(props);

  let new_props = props;

  new_props["id"] = old_props["data"]["id"];

  // // get the ids of old data
  // const available_refs = {
  // 	element_props: old_props["data"]["id"]
  // }
  // for (const type in old_props["data"]["references"]) {
  // 	available_refs[type] = old_props["data"]["references"][type]["id"]
  // }

  // // assign to the new ones
  // for (const type in new_props) {
  // 	new_props[type]["id"] = available_refs[type]
  // }

  return new_props;
};
