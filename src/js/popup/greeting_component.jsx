import React from "react";
import { hot } from "react-hot-loader";
import constant from "../helpers/constant";
import { giveUrl } from "../helpers/geturls";
import _ from "lodash";
import ReactTooltip from "react-tooltip";
import Slider from "rc-slider";
import Tooltip from "rc-tooltip";

/**
 * IMPORTANT
 *
 * Need to close the popup before the background script injects
 * content script. Else it will run some functions again from popup.
 * Which will result in exponentially increasing the active content scripts
 */

// slider imports - for speed control
const createSliderWithTooltip = Slider.createSliderWithTooltip;
const SliderWithTooltip = createSliderWithTooltip(Slider);
const Handle = SliderWithTooltip.Handle;

class GreetingComponent extends React.Component {
  state = {
    is_logged_in: false,
    logged_in_as: "",
    email: "",
    password: "",
    hostname: "",
    is_host_registered: false,
    mode: "root", // currently selected action
    record_url: "", // the initial page of recording session
    record_name: "", // the test session name
    record_description: "", // the test session description
    record_feature: "", // test feature name
    new_feature: "", // new feature name
    record_application: "", // the related application name
    formatted_data: [], // the formatted response from api - includes applications and it's testcases
    selected_playback: "select", // selected testsession for playback
    selected_application: "select", // selected application for playback
    features: [], // existing features
    speed: 5000, // testcase execution speed
  };

  /**
   * @description make the api call to get all the available applications and testsessions
   */
  componentWillMount() {
    this.getTableSessions();
  }

  /**
   * @description assign the current data for the
   */
  componentDidMount() {
    const that = this;
    // set the last action if present
    chrome.storage.local.get("current_action", (item) => {
      if (item.current_action) {
        this.setState({ mode: item.current_action });
      }
    });

    // set the speed if present, else set the default one
    chrome.storage.local.get("execution_speed", (item) => {
      if (item.execution_speed) {
        this.setState({ speed: item.execution_speed });
      } else {
        // set the default delay if it is not set
        chrome.storage.local.set({ execution_speed: constant.default_playback_speed }, function () {
          console.log(`execution_speed was not present. set to ${constant.default_playback_speed} successfully`);
        });
      }
    });

    // get the login status
    chrome.storage.sync.get(["login", "login_email"], (result) => {
      if (result.login) {
        that.setState({ is_logged_in: true, logged_in_as: result.login_email });
      } else {
        that.setState({ is_logged_in: false });
      }
    });

    // get the host status
    chrome.storage.sync.get(["is_host_registered", "hostname"], (result) => {
      if (Object.keys(result).length === 0 && result.constructor === Object) {
        that.setState({ hostname: "" });
      } else {
        that.setState({ hostname: result.hostname });
      }
    });
  }

  /**
   * @description update the state based on the name of the input field
   */
  setInput = (e) => {
    if (e.target.name === "record_url") {
      this.setState({ record_url: e.target.value });
    } else if (e.target.name === "record_application") {
      this.setState({ record_application: e.target.value });
    } else if (e.target.name === "record_feature") {
      this.setState({ record_feature: e.target.value, new_feature: "" });
    } else if (e.target.name === "new_feature") {
      this.setState({ new_feature: e.target.value, record_feature: "create_new" });
    } else if (e.target.name === "record_name") {
      this.setState({ record_name: e.target.value });
    } else if (e.target.name === "record_description") {
      this.setState({ record_description: e.target.value });
    } else if (e.target.name === "application_name") {
      this.setState({ selected_application: e.target.value });
    } else if (e.target.name === "playback_name") {
      this.setState({ selected_playback: e.target.value });
    } else if (e.target.name === "email") {
      this.setState({ email: e.target.value });
    } else if (e.target.name === "password") {
      this.setState({ password: e.target.value });
    } else if (e.target.name === "hostname") {
      this.setState({
        // mode: "root",
        is_host_registered: true,
        hostname: e.target.value,
      });
      chrome.storage.sync.set({ is_host_registered: true, hostname: e.target.value }, () => {});
    }
  };

  /**
   * @description change the testcase speed and store it in chrome storage
   */
  speedChange = (e) => {
    chrome.storage.local.set({ execution_speed: e }, function () {});
  };

  /**
   * @description used by the react slider to render the tooltip component
   */
  handle = (props) => {
    const { value, dragging, index, ...restProps } = props;
    return (
      <Tooltip prefixCls="rc-slider-tooltip" overlay={value} visible={dragging} placement="top" key={index}>
        <Handle value={value} {...restProps} />
      </Tooltip>
    );
  };

  /**
   * @description make the api call to get all the available testsessions
   */
  getTableSessions = async () => {
    let strapi_url_graphql = await giveUrl("strapi_url_graphql");
    // console.log("get graphql url", strapi_url_graphql);

    chrome.storage.local.get("login_id", (item) => {
      const login_id = item.login_id;

      if (login_id) {
        fetch(`${strapi_url_graphql}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query: `query {
							users(where: {id: "${login_id}"}) {
							  id
							  email
							  
							  applications {
								id
								name
								
								testcases {
								  id
								  name

								  feature {
									  id
									  name
								  }
								}
							  }
							}
						  }`,
          }),
        })
          .then((res) => res.json())
          .then((res) => {
            // console.log("res ---->", res);

            const data = {};
            const features = [];

            for (const app of res.data.users[0]["applications"]) {
              const temp = {
                name: app.name,
                id: app.id,
                testcases: [],
              };
              for (const testcase of app["testcases"]) {
                temp.testcases.push({ name: testcase.name, id: testcase.id });
                if (testcase.feature) {
                  features.push({
                    id: testcase.feature.id,
                    name: testcase.feature.name,
                  });
                }
              }
              data[app.id] = temp;
            }

            this.setState({
              formatted_data: data,
              features: _.uniqBy(features, "id"),
            });
          })
          .catch((err) => {
            console.log(err);
          });
      }
    });
  };

  /**
   * @description sends a message to background script to record a testsession on a given url
   */
  startRecording = () => {
    let { record_url, record_name, record_description, record_application, record_feature, new_feature } = this.state;
    let newFeature = false;

    // for custom feature name
    if (record_feature === "select" || record_feature === "create_new") {
      newFeature = true;
      record_feature = new_feature;
    }

    // check if the name is not empty
    if (record_name.length > 0) {
      if (record_application.length > 0) {
        if (record_feature.length > 0) {
          let unique_value = true;

          for (const feature of this.state.features) {
            if (record_feature.toLowerCase() === feature.name.toLowerCase()) {
              unique_value = false;
            }
          }

          if (unique_value) {
            // check if the url is valid
            // let rex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/
            let rex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
            if (rex.test(record_url)) {
              if (!record_url.includes("http") && !record_url.includes("https")) {
                record_url = `http://${record_url}`;
              }

              const port = chrome.extension.connect({
                name: "start_recording",
              });

              port.postMessage({
                type: "START",
                record_name,
                record_description,
                newFeature,
                record_feature,
                record_url,
                record_application,
              });

              chrome.storage.local.set({ current_action: "record_in_execution" });
              this.setState({ mode: "record_in_execution" });

              window.close();
            } else {
              alert("Please enter the valid url");
            }
          } else {
            alert("Feature is already present. Please select it from the dropdown menu.");
          }
        } else {
          alert("Please select the feature");
        }
      } else {
        alert("Please select the application");
      }
    } else {
      alert("Please enter the testcase name");
    }
  };

  /**
   * @description send the command to background script to record the anchor
   */
  recordAnchor = () => {
    const port = chrome.extension.connect({
      name: "record_anchor",
    });
    port.postMessage({ type: "ANCHOR" });
    window.close();
  };

  CapturePagination = () => {
    const port = chrome.extension.connect({
      name: "record_Grid_pagination",
    });
    port.postMessage({ type: "GRID" });
    window.close();
  };

  /**
   * @description send the command to background script to close the test window
   */
  stopRecording = () => {
    const port = chrome.extension.connect({
      name: "stop_recording",
    });
    port.postMessage({ type: "STOP" });
    chrome.storage.local.set({ current_action: "root" });
    this.setState({ mode: "root" }, () => {
      window.close();
    });
  };

  /**
   * @description send the command to background script to run the AI demo testcase
   */
  playtest = () => {
    if (this.state.selected_application) {
      if (this.state.selected_playback) {
        const port = chrome.extension.connect({
          name: "play_test",
        });
        port.postMessage({
          type: "PLAY_TEST",
          data: this.state.selected_playback,
        });
        window.close();
      } else {
        alert("select the testcase");
      }
    } else {
      alert("Please select the application");
    }
  };

  /**
   * @description send the command to background script to record the anchor
   */

  // giveUrl = () => {
  //   console.log("url function called --->");
  //   // return "value";
  //   return new Promise(function(resolve, reject) {
  //     chrome.storage.sync.get(["is_host_registered", "hostname"], result => {
  //       console.log("hostname ---->", result);
  //       resolve(result.hostname);
  //     });
  //   });
  // };

  performLogin = async () => {
    const that = this;

    if (this.state.hostname.trim().length === 0) {
      alert("Please enter server hostname");
    } else if (this.state.email.trim().length === 0) {
      alert("Please enter your registered email");
    } else if (this.state.password.trim().length === 0) {
      alert("Please enter the password");
    } else {
      const rex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

      let get_login_url = await giveUrl("login");

      if (rex.test(this.state.email)) {
        fetch(`${get_login_url}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            identifier: this.state.email,
            password: this.state.password,
          }),
        })
          .then((res) => res.json())
          .then((res) => {
            if (res.user !== undefined) {
              chrome.storage.sync.set({ login: true, login_email: that.state.email }, () => {
                that.setState({
                  mode: "root",
                  is_logged_in: true,
                  logged_in_as: that.state.email,
                });
              });
              chrome.storage.local.set({ login_id: res.user.id }, () => {
                // console.log(`login id set to ${res.user.id}`);
                this.getTableSessions();
              });
            } else {
              alert("Verification Failed. Please verify the credentials.");
            }
          })
          .catch((err) => {
            alert("Oops! Verification Failed");
            console.log("Error in the user verification");
            console.log(err);
          });
      } else {
        alert("Email format is incorrect. Please verify.");
      }
    }
  };

  setHostname = async () => {
    if (this.state.hostname.trim().length === 0) {
      alert("Please enter hostname");
    } else {
      chrome.storage.sync.set({ is_host_registered: true, hostname: this.state.hostname }, () => {
        this.setState({
          // mode: "root",
          is_host_registered: true,
          hostname: this.state.hostname,
        });
      });
    }
  };

  /**
   * @description logout and clear the login information
   */
  logout = () => {
    const that = this;
    chrome.storage.sync.set({ login: false, login_email: "" }, function () {
      that.setState({ is_logged_in: false });
    });
  };

  /**
   * @description render the logged in user info - just read only
   */
  renderUserInfo = () => {
    return (
      <React.Fragment>
        <div className="notice-title">Logged in as</div>
        <div className="notice">
          <div className="user-icon-container">
            <div className="user-icon" />
          </div>
          <span>{this.state.logged_in_as}</span>
        </div>
      </React.Fragment>
    );
  };

  /**
   * @description render the root screen
   */
  renderRoot = () => {
    if (this.state.mode === "root") {
      return (
        <React.Fragment>
          {this.renderUserInfo()}
          <div className="extension-actions">
            <ReactTooltip id="record-tooltip" place="top" type="dark" effect="solid">
              Record a new Testcase
            </ReactTooltip>
            <ReactTooltip id="run-tooltip" place="top" type="dark" effect="solid">
              Run Existing Testcase
            </ReactTooltip>
            <ReactTooltip id="logout-tooltip" place="top" type="dark" effect="solid">
              Logout
            </ReactTooltip>
            <div className="action-icon" data-tip="record-tooltip" data-for="record-tooltip" onClick={(e) => this.setState({ mode: "record" })}>
              <div className="record" />
            </div>
            <div className="action-icon" data-tip="run-tooltip" data-for="run-tooltip" onClick={(e) => this.setState({ mode: "run" })}>
              <div className="run" />
            </div>
            <div className="action-icon" data-tip="logout-tooltip" data-for="logout-tooltip" onClick={(e) => this.logout()}>
              <div className="logout" />
            </div>
          </div>
        </React.Fragment>
      );
    }
  };

  /**
   * @description render the screen when user clicks on record button
   */
  renderRecord = () => {
    // get the available applications
    const available_applications = [];
    for (const app_id in this.state.formatted_data) {
      available_applications.push({
        id: app_id,
        name: this.state.formatted_data[app_id]["name"],
      });
    }

    if (this.state.mode === "record") {
      return (
        <div className="inner-menu-container">
          <div className="heading">
            <div className="back-button" onClick={(e) => this.setState({ mode: "root" })} />
            <div className="inner-menu-title">Record a new testcase</div>
          </div>
          <div className="inner-menu-content">
            <select className="record-input full" name="record_application" onChange={this.setInput}>
              <option defaultChecked value="select">
                Select Application
              </option>
              {available_applications.map((data, index) => {
                return (
                  <option key={index} value={data.id}>
                    {data.name}
                  </option>
                );
              })}
            </select>
            <select className="record-input full space" name="record_feature" onChange={this.setInput}>
              <option defaultChecked value="select">
                Select Feature
              </option>
              {this.state.features.map((data, index) => {
                return (
                  <option key={index} value={data.id}>
                    {data.name}
                  </option>
                );
              })}
              <option value="create_new">Add a new Feature</option>
            </select>
            {this.state.record_feature === "create_new" ? (
              <input onChange={this.setInput} name="new_feature" className="record-input space" placeholder="Enter the feature name" />
            ) : (
              <React.Fragment />
            )}
            <input onChange={this.setInput} name="record_name" className="record-input space" placeholder="Test name" />
            <textarea onChange={this.setInput} name="record_description" className="record-input textarea space" placeholder="Test Description" />
            <div className="nested">
              <input autoFocus onChange={this.setInput} name="record_url" className="record-input" placeholder="URL" />
              <div className="inner-menu-button-container" onClick={this.startRecording}>
                <div className="mark-icon" />
              </div>
            </div>
          </div>
        </div>
      );
    } else if (this.state.mode === "record_in_execution") {
      return (
        <div className="extension-actions">
          <ReactTooltip id="run-tooltip" place="top" type="dark" effect="solid">
            Stop Recording
          </ReactTooltip>
          <ReactTooltip id="anchor-tooltip" place="top" type="dark" effect="solid">
            Anchor an element with
            <br />
            the recorded element
          </ReactTooltip>
          <ReactTooltip id="grid-record-tooltip" place="top" type="dark" effect="solid">
            Capture Grid pagination
          </ReactTooltip>
          <div onClick={this.CapturePagination} className="action-icon" data-tip="grid-record-tooltip" data-for="grid-record-tooltip">
            <div className="grid" />
          </div>
          <div onClick={this.recordAnchor} className="action-icon" data-tip="anchor-tooltip" data-for="anchor-tooltip">
            <div className="anchor" />
          </div>
          <div onClick={this.stopRecording} className="action-icon" data-tip="run-tooltip" data-for="run-tooltip">
            <div className="stop" />
          </div>
        </div>
      );
    }
  };

  /**
   * @description render the screen when user clicks on record button
   */
  renderPlayback = () => {
    if (this.state.mode === "run") {
      const applications = [];

      // only show the applications
      for (const app_id in this.state.formatted_data) {
        applications.push({
          id: app_id,
          name: this.state.formatted_data[app_id]["name"],
        });
      }

      return (
        <div className="inner-menu-container">
          <div className="heading">
            <div className="back-button" onClick={(e) => this.setState({ mode: "root" })} />
            <div className="inner-menu-title">Play the recorded testcase</div>
          </div>
          <div className="inner-menu-content">
            <select className="record-input full" name="application_name" onChange={this.setInput}>
              <option defaultChecked value="select">
                Select Application
              </option>
              {applications.map((data) => {
                return <option value={data.id}>{data.name}</option>;
              })}
            </select>

            <div className="nested">
              {this.state.selected_application === "select" ? (
                <select className="record-input" disabled={true}>
                  <option defaultChecked value="select">
                    Select Testcase
                  </option>
                </select>
              ) : (
                <select className="record-input" name="playback_name" onChange={this.setInput}>
                  <option defaultChecked value="select">
                    Select Testcase
                  </option>
                  {this.state.formatted_data[this.state.selected_application]["testcases"].map((testcase) => {
                    return <option value={testcase.id}>{testcase.name}</option>;
                  })}
                </select>
              )}

              <div className="inner-menu-button-container" onClick={this.playtest}>
                <div className="play-icon" />
              </div>
            </div>

            <div className="speed-container">
              <div className="inline-title left">FAST</div>
              <SliderWithTooltip
                className="flip-slider"
                min={100}
                max={30000}
                step={100}
                defaultValue={this.state.speed}
                onChange={this.speedChange}
                handle={this.handle}
                trackStyle={{
                  backgroundColor: "#1DD1A1",
                  height: 4,
                  borderRadius: 2,
                }}
                handleStyle={{
                  borderColor: "white",
                  height: 12,
                  width: 12,
                  marginLeft: -4,
                  marginTop: -4,
                  backgroundColor: "#45b4e2",
                }}
                railStyle={{
                  backgroundColor: "#feca57",
                  height: 4,
                  borderRadius: 2,
                }}
                tipFormatter={(value) => `${value} Milliseconds`}
              />
              <div className="inline-title right">SLOW</div>
            </div>
          </div>
        </div>
      );
    }
  };

  /**
   * @description render the login screen
   */

  // renderHostname = () => {
  //   console.log("renderhost", this.state.is_host_registered);

  //   if (!this.state.is_host_registered) {
  //     return (
  //       <div className="inner-menu-container">
  //         <div className="heading">
  //           <div className="inner-menu-title nope">Please enter host server</div>
  //         </div>
  //         <div className="inner-menu-content">
  //           <div className="nested">
  //             <input type="hostname" value={this.state.hostname} onChange={this.setInput} name="hostname" className="record-input" placeholder="e.g. localhost:1337" />
  //             <div className="inner-menu-button-container sethost-container" onClick={e => this.setHostname()}>
  //               <div className="sethost-icon" />
  //             </div>
  //           </div>
  //         </div>
  //       </div>
  //     );
  //   }
  // };

  renderLogin = () => {
    if (!this.state.is_logged_in) {
      return (
        <div className="inner-menu-container">
          <div className="heading">
            {/* <div
              className="back-button"
              style={{ marginRight: 5 }}
              onClick={() => [
                chrome.storage.sync.set({ is_host_registered: false, hostname: this.state.hostname }, () => {
                  console.log(this.state.hostname);

                  this.setState({
                    // mode: "root",
                    is_host_registered: false
                    // hostname: this.state.hostname
                  });
                })
              ]}
            /> */}
            <div className="inner-menu-title nope">Enter Server Hostname</div>
          </div>
          <div className="inner-menu-content">
            <input
              type="hostname"
              autoFocus
              value={this.state.hostname}
              onChange={this.setInput}
              name="hostname"
              className="record-input"
              placeholder="http://localhost:1337"
              style={{ marginBottom: 8 }}
            />
            <div className="divider" />

            {/* <div className="inner-menu-title nope">Please login to continue</div> */}

            <input type="email" onChange={this.setInput} name="email" className="record-input first-input-margin" placeholder="registered email" />
            <div className="nested">
              <input type="password" onChange={this.setInput} name="password" className="record-input" placeholder="password" />
              <div className="inner-menu-button-container" onClick={(e) => this.performLogin()}>
                <div className="unlock-icon" />
              </div>
            </div>
          </div>
        </div>
      );
    }
  };

  /**
   * @description render the screen based on the selected option
   */
  renderFunctionalities = () => {
    if (this.state.is_logged_in) {
      return (
        <React.Fragment>
          {/* {this.renderUserInfo()} */}
          {this.renderRoot()}
          {this.renderRecord()}
          {this.renderPlayback()}
        </React.Fragment>
      );
    }
  };

  /**
   * @description main render function
   */
  render() {
    // console.log("state change: ", this.state);
    return (
      <div className="main-ext-holder">
        <div className="top-container">
          <div className="logo" />
          <p className="version-container">V 1.0</p>
        </div>

        <div className="middle-container">
          {/* {this.renderHostname()} */}
          {this.renderLogin()}
          {this.renderFunctionalities()}
        </div>
      </div>
    );
  }
}

export default hot(module)(GreetingComponent);
