import { _error, _warning, _info } from "./helperFunctions";
import { makeDescription, makeid, notify } from "./helperFunctions";
import constant from "../helpers/constant";
import { giveUrl } from "../helpers/geturls";
import { openPlaybackWindow } from "./tabFunctions";

// for playback processing

/**
 *
 * @param {*} request
 * @param {*} index
 * @param {*} session_id
 * @param {*} base64data
 */
export const processPlaybackRun = async function(id) {
  try {
    const data = await getPlaybackData(id);
    _warning("Playback data");
    console.log(data);

    if (data.length > 0) {
      if (data[0]["step_data"].action === "open_url") {
        const url = data[0]["step_data"].description.split(" - ").length > 1 ? data[0]["step_data"].description.split(" - ")[1] : "";
        const height = data[0]["step_data"]["browser_height"] ? data[0]["step_data"]["browser_height"] : window.screen.height;
        const width = data[0]["step_data"]["browser_width"] ? data[0]["step_data"]["browser_width"] : window.screen.width;

        if (url !== "") {
          chrome.storage.local.set(
            {
              playbacksession: { data: data },
              playback_session_id: id,
              isPlaying: true,
              isRecording: false
            },
            function() {
              openPlaybackWindow(url, height, width);
            }
          );
        } else {
          alert("Unable to get the url to start");
        }
      } else {
        alert(`First step of testsession must be opening a url. But for current case it is ${data[0].action}`);
      }
    } else {
      alert(`Seems like the recording data is missing or empty`);
    }
  } catch (error) {
    _error("error in processPlaybackRun");
    console.error(error);
  }
};

const getPlaybackData = async function(id) {
  try {
    const query = `{
			testcases(where: { id: "${id}" }) {
			  name
			  
			  testcasecomponents {
				type
				related_object_id
				sequence_number

				objectrepository {
				  id
				  url
				  alias_name
				  page_url
				  thumbnail_url
				  highlighted_image_url
				  horizontal_anchor_text
				  vertical_anchor_text
				  object_by_lable
				  action
				  element_type
				  element_label
				  element_id
				  element_value
				  element_xpaths
				  element_css
				  element_health
				  element_attributes
				  parent_element_attributes
				  element_snapshot
				  description
				  nlu
				  browser_height
				  browser_width
				  tag
				  protocol
				  query_parameters
				  domain
				  path
				  text
				  x_scroll
				  y_scroll
				  pixel_ratio
				  parent_x_cord
				  parent_y_cord
				  x_cord
				  y_cord
				  height
				  width
          placeholder
          value
				}
			  }
			}
		  }`;

    let strapi_url_graphql = await giveUrl("strapi_url_graphql");
    console.log("get graphql url", strapi_url_graphql);
    // graphql api call
    // const api_req = await fetch(`${constant.strapi_url_graphql}`, {
    const api_req = await fetch(`${strapi_url_graphql}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        query
      })
    });

    // api response
    let api_resp = await api_req.json();

    // construct the object based on main ui steps
    const data_obj = {};
    api_resp["data"]["testcases"][0]["testcasecomponents"].map(inst => {
      if (inst["type"] === "ui") {
        data_obj[inst["objectrepository"]["id"]] = {
          index: Number(inst["sequence_number"]),
          id: inst["objectrepository"]["id"],
          step_data: inst["objectrepository"],
          references: {}
        };
      }
    });

    // add the reference data for the related ui element
    api_resp["data"]["testcases"][0]["testcasecomponents"].map(inst => {
      if (inst["type"] !== "ui") {
        if (inst["related_object_id"]) {
          data_obj[inst["related_object_id"]]["references"][inst["type"]] = inst["objectrepository"];
        }
      }
    });

    // convert from object to array
    const data_arr = [];
    for (const data in data_obj) {
      data_arr.push(data_obj[data]);
    }

    // sort by "index" value to make sure that the test can run with removed elements
    return _.orderBy(data_arr, ["index"], ["asc"]);
  } catch (error) {
    _error("error in getPlaybackData");
    console.error(error);
  }
};

// for post

export const procesPostframe = async function(request, index, session_id, middleInsertion) {
  try {
    // get all the payloads first
    const post_payload = {
      action: "selectframe",
      frame: request.frameLocation,
      description: `select frame to ${request.frameLocation}`
    };

    _error("post_payload");
    // remove extra space
    // let element_css = post_payload["element_css"].replace(/  +/g, " ");
    // console.log("after space removal", element_css);
    // post_payload["element_css"] = element_css;
    // post_payload["element_attributes"]["class"] = element_css;
    // console.log("post_payload....", post_payload);
    let strapi_url = await giveUrl("strapi_url");
    // const createOR = await fetch(`${constant.strapi_url}/objectrepositories`, {
    const createOR = await fetch(`${strapi_url}/objectrepositories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post_payload)
    });
    const orResp = await createOR.json();

    const testcompPayload = {
      type: "ui",
      objectrepository: orResp.id,
      testcase: session_id
    };

    if (middleInsertion && middleInsertion > 0) {
      testcompPayload["sequence_number"] = middleInsertion + "." + index;
    } else {
      testcompPayload["sequence_number"] = index;
    }
    // const createTestComp = await fetch(`${constant.strapi_url}/testcasecomponents`, {
    const createTestComp = await fetch(`${strapi_url}/testcasecomponents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testcompPayload)
    });
    const testCompResp = await createTestComp.json();

    // notify(`Step ${index} added successfully`)
    _warning(`Step ${index} added successfully`);
  } catch (error) {
    _error("Couldn't post fdetails");
  }
};

/**
 * @description process the post methods
 *
 *
 */

export const processPost = async function(request, index, session_id, base64data, tabInfo, middleInsertion) {
  try {
    // get all the payloads first
    const post_payload = await prepareData(request.props, request.action, request.value, index);

    _error("post_payload");

    /* assign the value if present
		if (request.value) {
			post_payload["element_value"] = request.value.trim() !== "" ? request.value : ""
		}*/

    // post the element level details first

    // testing -----------------

    // if (post_payload["element_xpaths"][0] === "//*[@id='root']/section[2]/div/div/div[1]/div/div[2]/div/div[2]/div[2]/div[3]/div/div") {
    // remove extra line break from string
    // let desc = post_payload["description"].replace(/\n/gi, "");
    // let text = post_payload["text"].replace(/\n/gi, "");
    // post_payload["description"] = desc;
    // post_payload["text"] = text;
    // }
    let element_css = post_payload["element_css"].replace(/  +/g, " ");
    // console.log("after space removal", element_css);
    post_payload["element_css"] = element_css;
    post_payload["element_attributes"]["class"] = element_css;
    // insert tab index
    post_payload["current_tab"] = parseInt(tabInfo["index"]);
    post_payload["y_scroll"] = Math.round(post_payload["y_scroll"]);

    // encrypt password field
    if (post_payload["element_attributes"]["type"]) {
      if (post_payload["element_attributes"]["type"].toLowerCase() === "password") {
        if (post_payload["element_value"] !== "") {
          const bufferText = Buffer.from(post_payload["element_value"], "utf8"); // or Buffer.from('hello world')
          const encode_value = bufferText.toString("hex");
          post_payload["element_value"] = encode_value;
        }
      }
    }

    // let pagination_xapth = await getXpath();

    // console.log("pagination xpath ---->", pagination_xapth);

    console.log("post_payload....", post_payload);

    // get row data
    var get_full_xpath = post_payload.element_xpaths.sort(function(a, b) {
      return b.length - a.length;
    })[0];
    // let selected_grid_data = {};
    // console.log("get xpath ==", get_full_xpath);

    // if (get_full_xpath.includes("table")) {
    //   selected_grid_data["grid"] = true;
    //   selected_grid_data["row_data"] = [];

    //   let path = get_full_xpath.split("td");
    //   console.log("columns finder ---->", path);

    //   var col_count = document.evaluate(`count(${path[0]}/td)`, document, null, XPathResult.ANY_TYPE, null);
    //   console.log("table col count--------------------->", col_count.numberValue);

    //   // get row data --------------
    //   for (let i = 1; i <= col_count.numberValue; i++) {
    //     var headings = document.evaluate(`${path[0]}/td[${i}]`, document, null, XPathResult.ANY_TYPE, null);
    //     /* Search the document for all h2 elements.
    //      * The result will likely be an unordered node iterator. */
    //     var thisHeading = headings.iterateNext();
    //     var colText = "";
    //     while (thisHeading) {
    //       colText = thisHeading.textContent + "\n";
    //       thisHeading = headings.iterateNext();
    //     }
    //     selected_grid_data["row_data"].push(colText);
    //   }
    //   console.log("row data ---->", selected_grid_data);
    // }
    let strapi_url = await giveUrl("strapi_url");
    // const createOR = await fetch(`${constant.strapi_url}/objectrepositories`, {
    const createOR = await fetch(`${strapi_url}/objectrepositories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post_payload)
    });
    const orResp = await createOR.json();
    console.log("processing data ----->", orResp);

    if (orResp.id) {
      if (get_full_xpath.includes("table")) {
        chrome.storage.local.get(["grid_xpath"], function(result) {
          console.log("Value currently is " + result.grid_xpath);
          let payload = {
            grid_pagination_xpath: result.grid_xpath
          };
          if (result.grid_xpath) {
            // fetch(`${constant.strapi_url}/objectrepositories/${orResp.id}`, {
            fetch(`${strapi_url}/objectrepositories/${orResp.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
          }
        });
      }
    }

    const testcompPayload = {
      type: "ui",
      objectrepository: orResp.id,
      testcase: session_id
    };

    if (middleInsertion && middleInsertion > 0) {
      testcompPayload["sequence_number"] = middleInsertion + "." + index;
    } else {
      testcompPayload["sequence_number"] = index;
    }

    // const createTestComp = await fetch(`${constant.strapi_url}/testcasecomponents`, {
    const createTestComp = await fetch(`${strapi_url}/testcasecomponents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testcompPayload)
    });
    const testCompResp = await createTestComp.json();

    if (base64data) {
      // create fiel object
      const createFileObjReq = await fetch(base64data);
      const createFileObjRes = await createFileObjReq.blob();
      const createFileObj = new File([createFileObjRes], "file");

      // upload and link the latest image
      const payloadData = new FormData();
      payloadData.append("files", createFileObj);
      payloadData.append("ref", "objectrepository");
      payloadData.append("refId", orResp.id);
      payloadData.append("field", "base_image");

      // const imageUploadReq = await fetch(`${constant.strapi_url}/upload`, {
      const imageUploadReq = await fetch(`${strapi_url}/upload`, {
        method: "POST",
        body: payloadData
      });
      const imageUploadRes = await imageUploadReq.json();
    }

    // notify(`Step ${index} added successfully`)
    _warning(`Step ${index} added successfully`);

    /* save the parent elements information

		for (const type in post_payloads) {

			if (type === "parent_props_level_1" || type === "parent_props_level_2") {
				const createRelatedOR = await fetch(`${constant.strapi_url}/objectrepositories`, {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify(post_payloads[type])
				})
				const orRelatedResp = await createRelatedOR.json()

				const createRelatedTestComp = await fetch(`${constant.strapi_url}/testcasecomponents`, {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify({
						type,
						related_object_id: orResp.id,
						objectrepository: orRelatedResp.id,
						testcase: session_id
					})
				})
				const testRelatedCompResp = await createRelatedTestComp.json()

				_warning(`relation ${type} added successfully`)
			}

		}
		// */
  } catch (error) {
    _error("error in processPost");
    console.error(error);
  }
};

/**
 * @returns {Object} formatted data
 * @description converts raw data to post api payload
 */
export const prepareData = function(request, action, value, index) {
  return new Promise((resolve, reject) => {
    try {
      /**
			 * nlu
			 
			 * alias_name
			 * horizontal_anchor_text
			 * vertical_anchor_text
			 * element_health
			 * element_label
			 * tag
			 * 
			 */
      // console.log("request_data.....", request);

      const post_data = {
        pixel_ratio: request.pixel_ratio,
        text: request.text,
        element_type: request.type,

        // url related information
        url: request.url,
        domain: request.domain,
        protocol: request.protocol,
        path: request.path,
        query_parameters: request.query_parameters,
        element_xpaths: [],
        grid_data: request.gird_row
      };

      if (index) {
        post_data["tag"] = makeid(6) + "_" + index + "_" + +new Date();
      }

      if (request.id) {
        post_data["id"] = request.id;
      }

      // optional data

      // all possible xpaths
      // let xpaths = []

      // let len = request.element_props.length
      // if (len > 0) {
      // 	let one = request.element_props[len - 1][0]
      // 	one = one.replace("xpath=", "")
      // 	if (one.length > 0) {
      // 		xpaths.push(one)
      // 	}

      // 	if (request.element_props[len - 2]) {
      // 		let two = request.element_props[len - 2][0]
      // 		two = two.replace("xpath=", "")
      // 		if (two.length > 0) {
      // 			xpaths.push(two)
      // 		}
      // 	}

      // 	if (request.element_props[len - 2]) {
      // 		let three = request.element_props[len - 2][0]
      // 		three = three.replace("xpath=", "")
      // 		if (three.length > 0) {
      // 			xpaths.push(three)
      // 		}
      // 	}

      // }
      // post_data.element_xpaths = _.uniq(xpaths)
      post_data.element_xpaths = request.element_props ? request.element_props : [];

      // parent related data
      post_data.parent_x_cord = request.parent_clientX ? Math.round(request.parent_clientX) : 0;
      post_data.parent_y_cord = request.parent_clientY ? Math.round(request.parent_clientY) : 0;
      post_data.parent_element_attributes = request.parent_attributes ? request.parent_attributes : {};

      // element position and main attributes
      post_data.action = action ? action : "";
      post_data.x_cord = request.clientX ? Math.round(request.clientX) : 0;
      post_data.y_cord = request.clientY ? Math.round(request.clientY) : 0;
      post_data.element_value = value ? value.replace("C:\\fakepath\\", "") : "";
      post_data.placeholder = request.attributes.placeholder ? request.attributes.placeholder : "";
      post_data.element_id = request.attributes.id ? request.attributes.id : "";
      post_data.element_css = request.attributes.class ? request.attributes.class : "";

      // scroll position + browser current height and width
      post_data.x_scroll = request.x_scroll ? request.x_scroll : 0;
      post_data.y_scroll = request.y_scroll ? request.y_scroll : 0;
      post_data.browser_height = request.browser_height;
      post_data.browser_width = request.browser_height;

      // height and width of element
      post_data.height = request.height ? Math.round(request.height) : -1;
      post_data.width = request.width ? Math.round(request.width) : -1;

      // all possible attributes of the element
      post_data.element_attributes = request.attributes ? request.attributes : {};

      // description value
      post_data.description = "";

      const d_value = value !== "" ? value : "";
      let d_field = "";
      if (request.text && request.text.length > 0) {
        d_field = request.text;
      } else if (request.attributes.placeholder && request.attributes.placeholder !== "") {
        d_field = request.attributes.placeholder;
      } else {
        d_field = request.type;
      }

      // if label is present, then store it
      if (request.element_label) {
        post_data.element_label = request.element_label ? request.element_label : "";
      }
      if (d_field !== "" && d_field !== undefined) {
        if (action === "text_input") {
          if (d_value !== "" && d_value !== undefined) {
            post_data.description = makeDescription(action, d_value, d_field);
          }
        } else if (action === "dropdown") {
          if (d_value !== undefined) {
            post_data.description = makeDescription(action, d_value, "dropdown");
          }
        } else if (action === "drag") {
          post_data.description = makeDescription(action, d_field, "drag");
        } else if (action === "drop") {
          post_data.description = makeDescription(action, d_field, "drop");
        } else if (action === "mouseover") {
          post_data.description = makeDescription(action, d_field, action);
        } else if (action === "fileupload") {
          post_data.description = "Upload File";
        } else {
          post_data.description = makeDescription(action, "", d_field);
        }
      }

      post_data.value = request.text !== undefined ? request.text : d_value ? d_value : "";
      // console.log("final object", post_data);
      resolve(post_data);
    } catch (error) {
      _error("error in preparing the post data");
      reject(error);
    }
  });
};

// for update

/**
 * @description process the update method
 */
export const processUpdate = async function(request, base64data) {
  try {
    // can use the old_data for the comparison
    const old_data = request.old_data;

    // get all the payloads first
    let update_payload = {};
    const element_id = request.props["id"];
    update_payload = await prepareData(request.props, request.action);

    // upload and link the latest image
    const createFileObjReq = await fetch(base64data);
    const createFileObjRes = await createFileObjReq.blob();
    const createFileObj = new File([createFileObjRes], "file");

    const payloadData = new FormData();
    payloadData.append("files", createFileObj);
    payloadData.append("ref", "objectrepository");
    payloadData.append("refId", element_id);
    payloadData.append("field", "base_image");

    let strapi_url = await giveUrl("strapi_url");
    // const imageUploadReq = await fetch(`${constant.strapi_url}/upload`, {
    const imageUploadReq = await fetch(`${strapi_url}/upload`, {
      method: "POST",
      body: payloadData
    });
    const imageUploadRes = await imageUploadReq.json();

    // assign the value if present
    if (request.value) {
      update_payload["element_value"] = request.value.trim() !== "" ? request.value : "";
    }

    // const url = `${constant.strapi_url}/objectrepositories/${update_payload["id"]}`;
    const url = `${strapi_url}/objectrepositories/${update_payload["id"]}`;
    delete update_payload["id"];

    const update_api_call_req = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update_payload)
    });

    const update_api_call_res = await update_api_call_req.json();
    _warning("test steps updated successfully");
  } catch (error) {
    _error("error in processUpdate");
    console.error(error);
  }
};
