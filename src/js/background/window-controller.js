import { _info, _error } from "./helperFunctions";

/*
 * Copyright 2017 SideeX committers
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

export class ExtCommand {

    constructor(contentWindowId) {
        this.playingTabNames = {};
        this.playingTabIds = {};
        this.playingTabStatus = {};
        this.playingFrameLocations = {};
        this.playingTabCount = 1;
        this.currentPlayingTabId = -1;
        this.contentWindowId = contentWindowId ? contentWindowId : -1;
        this.currentPlayingFrameLocation = 'root';
        // TODO: flexible wait
        this.waitInterval = 500;
        this.waitTimes = 60;

        this.attached = false;

        // Use ES6 arrow function to bind correct this
        this.tabsOnUpdatedHandler = (tabId, changeInfo, tabInfo) => {
            if (changeInfo.status) {
                if (changeInfo.status == "loading") {
                    this.setLoading(tabId);
                } else {
                    this.setComplete(tabId);
                }
            }
        }

        this.frameLocationMessageHandler = (message, sender) => {
            
            if (message.frameLocation) {
                this.setFrame(sender.tab.id, message.frameLocation, sender.frameId);
            }
        }

        this.newTabHandler = (details) => {
            if (this.hasTab(details.sourceTabId)) {
                this.setNewTab(details.tabId);
            }
        }
    }

    async init() {
        this.attach();
        this.playingTabNames = {};
        this.playingTabIds = {};
        this.playingTabStatus = {};
        this.playingFrameLocations = {};
        this.playingTabCount = 1;
        this.currentPlayingWindowId = this.contentWindowId;
        let self = this;
        this.currentPlayingFrameLocation = "root";
        let tab = await this.queryActiveTab(this.currentPlayingWindowId);
        return this.setFirstTab(tab);
            //    .then(tab=>this.setFirstTab(tab));
    }

    clear() {
        this.detach();
        this.playingTabNames = {};
        this.playingTabIds = {};
        this.playingTabStatus = {};
        this.playingFrameLocations = {};
        this.playingTabCount = 1;
        this.currentPlayingWindowId = undefined;
    }

    attach() {
        if(this.attached) {
            return;
        }
        this.attached = true;
        chrome.tabs.onUpdated.addListener(this.tabsOnUpdatedHandler);
        chrome.runtime.onMessage.addListener(this.frameLocationMessageHandler);
        chrome.webNavigation.onCreatedNavigationTarget.addListener(this.newTabHandler);
    }

    detach() {
        if(!this.attached) {
            return;
        }
        this.attached = false;
        chrome.tabs.onUpdated.removeListener(this.tabsOnUpdatedHandler);
        chrome.runtime.onMessage.removeListener(this.frameLocationMessageHandler);
        chrome.webNavigation.onCreatedNavigationTarget.removeListener(this.newTabHandler);
    }

    setContentWindowId(contentWindowId) {
        this.contentWindowId = contentWindowId;
    }

    getContentWindowId() {
        return this.contentWindowId;
    }

    getCurrentPlayingTabId() {
        return this.currentPlayingTabId;
    }

    getCurrentPlayingFrameLocation() {
        return this.currentPlayingFrameLocation;
    }

    getFrameId(tabId) {
        
        if (tabId >= 0) {
            return this.playingFrameLocations[tabId][this.currentPlayingFrameLocation];
        } else {
            return this.playingFrameLocations[this.currentPlayingTabId][this.currentPlayingFrameLocation];
        }
    }

    getCurrentPlayingFrameId() {
        return this.getFrameId(this.currentPlayingTabId);
    }

    getPageStatus() {
        return this.playingTabStatus[this.getCurrentPlayingTabId()];
    }

    queryActiveTab(windowId) {
        _info(windowId)

        return new Promise((resolve,reject)=>{
             chrome.tabs.query({windowId: windowId, active: true},tabs=>{
                // _error("AA CHE DATA")
                // console.log(tabs)
                resolve(tabs[0]);
            })
        })
    }

    async sendCommand(command, target, value, top) {
        let tabId = this.getCurrentPlayingTabId();
        let frameId = this.getCurrentPlayingFrameId();

        // _error(tabId)
        // _error(frameId)
        let val = await this.sendMessagePromise(tabId,{
            commands: command,
            target: target,
            value: value
        }, { frameId: top ? 0 : frameId })
            
        return val
    }

    sendMessagePromise(tabId, item,option) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, item, option,response => {
                resolve(response);
            });
        });
    }
    setLoading(tabId) {
        // Does clearing the object will cause some problem(e.g. missing the frameId)?
        // Ans: Yes, but I don't know why
        this.initTabInfo(tabId);
        // this.initTabInfo(tabId, true); (failed)
        this.playingTabStatus[tabId] = false;
    }

    setComplete(tabId) {
        this.initTabInfo(tabId);
        this.playingTabStatus[tabId] = true;
    }

    initTabInfo(tabId, forced) {
        if (!this.playingFrameLocations[tabId] | forced) {
            this.playingFrameLocations[tabId] = {};
            this.playingFrameLocations[tabId]["root"] = 0;
        }
    }

    setFrame(tabId, frameLocation, frameId) {
        this.playingFrameLocations[tabId][frameLocation] = frameId;
    }

    hasTab(tabId) {
        return this.playingTabIds[tabId];
    }

    setNewTab(tabId) {
        this.playingTabNames["win_ser_" + this.playingTabCount] = tabId;
        this.playingTabIds[tabId] = "win_ser_" + this.playingTabCount;
        this.playingTabCount++;
    }

    doOpen(url) {
        return chrome.tabs.update(this.currentPlayingTabId, {
            url: url
        })
    }

    doPause(target, value) {
        return new Promise(function(resolve) {
            var milliseconds = target || value;
            try {
                milliseconds = parseInt(milliseconds);
            } catch (e) {
                milliseconds = 0;
            }
            setTimeout(resolve, milliseconds);
        });
    }

    doSelectFrame(frameLocation) {
        let result = frameLocation.match(/(index|relative) *= *([\d]+|parent)/i);
        if (result && result[2]) {
            let position = result[2];
            if (position == "parent") {
                this.currentPlayingFrameLocation = this.currentPlayingFrameLocation.slice(0, this.currentPlayingFrameLocation.lastIndexOf(':'));
            } else {
                this.currentPlayingFrameLocation += ":" + position;
            }
            return this.wait("playingFrameLocations", this.currentPlayingTabId, this.currentPlayingFrameLocation);
        } else {
            return Promise.reject("Invalid argument");
        }
    }

    doSelectWindow(serialNumber) {
        if (serialNumber.indexOf('win_ser_') >= 0) {
            let self = this;
            return this.wait("playingTabNames", serialNumber)
                .then(function() {
                    self.currentPlayingTabId = self.playingTabNames[serialNumber];
                    return chrome.tabs.update(self.currentPlayingTabId, {active: true});
                })
        } else {
            var self = this;
            var title = serialNumber.substring('title='.length);
            return new Promise(function(resolve, reject) {
                var counter = 0;
                var interval = setInterval(
                    function() {
                        chrome.tabs.query({title: title})
                            .then(function(tabs) {
                                if (tabs.length > 0) {
                                    clearInterval(interval);
                                    var tabIds = [];
                                    for (var i = 0; i < tabs.length; i++) {
                                        tabIds.push(tabs[i].id);
                                    }
                                    var serialNumbers = Object.keys(self.playingTabNames);
                                    for (var i = 0; i < serialNumbers.length; i++) {
                                        var serialNumber = serialNumbers[i];
                                        if (serialNumber.indexOf('win_ser_') >= 0) {
                                            var tabId = self.playingTabNames[serialNumber];
                                            if (tabIds.indexOf(tabId) >= 0) {
                                                self.currentPlayingTabId = tabId;
                                                chrome.tabs.update(self.currentPlayingTabId, {active: true}).then(resolve);
                                            }
                                        }
                                    }
                                } else {
                                    counter++;
                                    if (counter > self.waitTimes) {
                                        reject("Timeout");
                                        clearInterval(interval);
                                    }
                                }
                            });
                    },
                    self.waitInterval
                );
            });
        }
    }

    doClose() {
        let removingTabId = this.currentPlayingTabId;
        this.currentPlayingTabId = -1;
        delete this.playingFrameLocations[removingTabId];
        return chrome.tabs.remove(removingTabId);
    }

    wait(...properties) {
        if (!properties.length)
            return Promise.reject("No arguments");
        let self = this;
        let ref = this;
        let inspecting = properties[properties.length - 1];
        for (let i = 0; i < properties.length - 1; i++) {
            if (!ref[properties[i]] | !(ref[properties[i]] instanceof Array | ref[properties[i]] instanceof Object))
                return Promise.reject("Invalid Argument");
            ref = ref[properties[i]];
        }
        return new Promise(function(resolve, reject) {
            let counter = 0;
            let interval = setInterval(function() {
                if (ref[inspecting] === undefined || ref[inspecting] === false) {
                    counter++;
                    if (counter > self.waitTimes) {
                        reject("Timeout");
                        clearInterval(interval);
                    }
                } else {
                    resolve();
                    clearInterval(interval);
                }
            }, self.waitInterval);
        })
    }

    updateOrCreateTab() {
        let self = this;
        return chrome.tabs.query({
                    windowId: self.currentPlayingWindowId,
                    active: true
               }).then(function(tabs) {
                   if (tabs.length === 0) {
                       return chrome.windows.create({
                          // KAT-BEGIN change to Katalon url
                          // url: "https://google.com"
                          url: "https://www.katalon.com"
                          // KAT-END
                       }).then(function (window) {
                           self.setFirstTab(window.tabs[0]);
                           self.contentWindowId = window.id;
                           recorder.setOpenedWindow(window.id);
                           chrome.runtime.getBackgroundPage()
                           .then(function(backgroundWindow) {
                               backgroundWindow.master[window.id] = recorder.getSelfWindowId();
                           });
                       })
                   } else {
                       let tabInfo = null;
                       return chrome.tabs.update(tabs[0].id, {
                                // KAT-BEGIN change to Katalon url
                                // url: "https://google.com"
                                url: "https://www.katalon.com"
                                // KAT-END
                              }).then(function(tab) {
                                  tabInfo = tab;
                                  return self.wait("playingTabStatus", tab.id);
                              }).then(function() {
                                  // Firefox did not update url information when tab is updated
                                  // We assign url manually and go to set first tab
                                  // KAT-BEGIN change to Katalon url
                                  // tabInfo.url = "https://google.com";
                                  tabInfo.url = "https://www.katalon.com";
                                  // KAT-END
                                  self.setFirstTab(tabInfo);
                              })
                   }
               })
    }

    setFirstTab(tab) {
        
        // _error("Set First Tab")
        // console.log(this);
        // console.log(tab);
        if (!tab || (tab.url && this.isAddOnPage(tab.url))) {
            return this.updateOrCreateTab()
        } else {
            this.currentPlayingTabId = tab.id;
            this.playingTabNames["win_ser_local"] = this.currentPlayingTabId;
            this.playingTabIds[this.currentPlayingTabId] = "win_ser_local";
            this.playingFrameLocations[this.currentPlayingTabId] = {};
            this.playingFrameLocations[this.currentPlayingTabId]["root"] = 0;
            // we assume that there has an "open" command
            // select Frame directly will cause failed
            this.playingTabStatus[this.currentPlayingTabId] = true;
        }
    }

    isAddOnPage(url) {
        if (url.startsWith("https://addons.mozilla.org") ||
            url.startsWith("https://chrome.google.com/webstore")) {
            return true;
        }
        return false;
    }
}

export function isExtCommand(command) {
    switch(command) {
        case "pause":
        //case "open":
        case "selectFrame":
        case "selectWindow":
        case "close":
            return true;
        default:
            return false;
    }
}
