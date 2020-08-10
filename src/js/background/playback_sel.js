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

import {ExtCommand,isExtCommand} from "./window-controller";
import { _info, _error } from "./helperFunctions";

var blockStack = [];
var labels = {};
var expectingLabel = null;

var currentPlayingCommandIndex = -1;
var currentPlayingFromHereCommandIndex = 0;

var currentTestCaseId = "";
var isPause = false;
var pauseValue = null;
var isPlayingSuite = false;
var isPlayingAll = false;
var selectTabId = null;
var isSelecting = false;

var commandType = "";
var pageCount = 0;
var pageTime = "";
var ajaxCount = 0;
var ajaxTime = "";
var domCount = 0;
var domTime = "";
var implicitCount = 0;
var implicitTime = "";

var caseFailed = false;
var extCommand = new ExtCommand();

function play() {

    initializePlayingProgress()
        .then(executionLoop)
        .then(finalizePlayingProgress)
        .catch(catchPlayingError);
}

function stop() {

    if (isPause){
        isPause = false;
        switchPR();
    }
    isPlaying = false;
    isPlayingSuite = false;
    isPlayingAll = false;
    switchPS();
    //sideex_log.info("Stop executing");
    initAllSuite();
    document.getElementById("result-runs").textContent = "0";
    document.getElementById("result-failures").textContent = "0";
    finalizePlayingProgress();
}

function playAfterConnectionFailed() {
    if (isPlaying) {
        initializeAfterConnectionFailed()
            .then(executionLoop)
            .then(finalizePlayingProgress)
            .catch(catchPlayingError);
    }
}

function initializeAfterConnectionFailed() {
    disableClick();

    isRecording = false;
    isPlaying = true;

    commandType = "preparation";
    pageCount = ajaxCount = domCount = implicitCount = 0;
    pageTime = ajaxTime = domTime = implicitTime = "";

    caseFailed = false;

    currentTestCaseId = getSelectedCase().id;
    var commands = getRecordsArray();

    return Promise.resolve(true);
}

function pause() {
    if (isPlaying) {
        //sideex_log.info("Pausing");
        isPause = true;
        isPlaying = false;
        // No need to detach
        // prevent from missing status info
        //extCommand.detach();
        switchPR();
    }
}

function resume() {
    if(currentTestCaseId!=getSelectedCase().id)
        setSelectedCase(currentTestCaseId);
    if (isPause) {
        //sideex_log.info("Resuming");
        isPlaying = true;
        isPause = false;
        extCommand.attach();
        switchPR();
        disableClick();
        executionLoop()
            .then(finalizePlayingProgress)
            .catch(catchPlayingError);
    }
}

function playSuite(i) {
    isPlayingSuite = true;
    var cases = getSelectedSuite().getElementsByTagName("p");
    var length = cases.length;
    /* KAT-BEGIN remove log
    if (i == 0) {
        //sideex_log.info("Playing test suite " + sideex_testSuite[getSelectedSuite().id].title);
    }
    KAT-END */
    if (i < length) {
        setSelectedCase(cases[i].id);
        setCaseScrollTop(getSelectedCase());
        //sideex_log.info("Playing test case " + sideex_testSuite[getSelectedSuite().id].title + " / " + sideex_testCase[cases[i].id].title);
        logStartTime();
        play();
        nextCase(i);
    } else {
        isPlayingSuite = false;
        switchPS();
    }
}

function nextCase(i) {
    if (isPlaying || isPause) setTimeout(function() {
        nextCase(i);
    }, 500);
    else if(isPlayingSuite) playSuite(i + 1);
}

function playSuites(i) {
    isPlayingAll = true;
    var suites = document.getElementById("testCase-grid").getElementsByClassName("message");
    var length = suites.length;
    if (i < length) {
        if (suites[i].id.includes("suite")) {
            setSelectedSuite(suites[i].id);
            playSuite(0);
        }
        nextSuite(i);
    } else {
        isPlayingAll = false;
        switchPS();
    }
}

function nextSuite(i) {
    if (isPlayingSuite) setTimeout(function() {
        nextSuite(i);
    }, 2000);
    else if(isPlayingAll) playSuites(i + 1);
}

export function executeCommand(command,tabid) {

    let commandName = command.action
    let commandTarget = command.target
    let commandValue = command.value

    chrome.tabs.sendMessage(tabid, {
        commands: commandName,
        target: commandTarget,
        value: commandValue
    }, {
        frameId: extCommand.getFrameId(tabid)
    }, function(result) {
        if (result.result != "success") {
            
            _error("failed")
            if (!result.result.includes("did not match")) {
                return true;
            }
        } else {
            _error("successs")
        }
    })

    finalizePlayingProgress();
}

function cleanStatus() {
    var commands = getRecordsArray();
    for (var i = 0; i < commands.length; ++i) {
        commands[i].setAttribute("class", "");
        commands[i].getElementsByTagName("td")[0].classList.remove("stopping");
    }
    classifyRecords(1, commands.length);
}

export async function initializePlayingProgress(contentWindowId,tabid) {

    extCommand.setContentWindowId(contentWindowId)

    currentPlayingCommandIndex = currentPlayingFromHereCommandIndex - 1;
    currentPlayingFromHereCommandIndex = 0;

    let val = await extCommand.init();
    return val;
}

export async function executionLoop(command) {

    let commandName = command.action
    let commandTarget = command.target
    let commandValue = command.value
    if (isExtCommand(commandName)) {
        //sideex_log.info("Executing: | " + commandName + " | " + commandTarget + " | " + commandValue + " |");
        commandName = formalCommands[commandName.toLowerCase()];
        let upperCase = commandName.charAt(0).toUpperCase() + commandName.slice(1);
        commandTarget = convertVariableToString(commandTarget);
        return (extCommand["do" + upperCase](commandTarget, commandValue))
    } else {
        
        _error("came")
        const doprep = await doPreparation()
        const dopreppagewait = await doPrePageWait() 
        const dopagewait = await doPageWait()
        const doajaxwait = await doAjaxWait()
        const dodomwait = await doDomWait()
        _info("gone")
        return await doCommand(command)
    }
}

function delay(t) {
    return new Promise(function(resolve,reject) {
        setTimeout(resolve, t)
    });
 }

function finalizePlayingProgress() {
    if (!isPause) {
        enableClick();
        extCommand.clear();
    }
}

export function catchPlayingError(reason) {
    console.log('Playing error', reason);
    // doCommands is depend on test website, so if make a new page,
    // doCommands funciton will fail, so keep retrying to get connection
    if (isReceivingEndError(reason)) {
        commandType = "preparation";
        setTimeout(function() {
            playAfterConnectionFailed();
        }, 100);
    } else if (reason == "shutdown") {
        return;
    } else {
        extCommand.clear();
    }
}

async function doPreparation() {
    //console.log("in preparation");
    return await extCommand.sendCommand("waitPreparation", "", "")
}


async function doPrePageWait() {
    //console.log("in prePageWait");
    const response = await extCommand.sendCommand("prePageWait", "", "")

    if (response && response.new_page) {
        //console.log("prePageWaiting");
        return await doPrePageWait();
    } else {
        return true;
    }
       
}

async function doPageWait() {
    //console.log("in pageWait");
    const response = await extCommand.sendCommand("pageWait", "", "")
    console.log(response);
    
    if (pageTime && (Date.now() - pageTime) > 30000) {
        //sideex_log.error("Page Wait timed out after 30000ms");
        pageCount = 0;
        pageTime = "";
        return true;
    } else if (response && response.page_done) {
        pageCount = 0;
        pageTime = "";
        return true;
    } else {
        pageCount++;
        if (pageCount == 1) {
            pageTime = Date.now();
            //sideex_log.info("Wait for the new page to be fully loaded");
        }
        return await doPageWait();
        return ""
    }
}

async function doAjaxWait() {
    const response = await extCommand.sendCommand("ajaxWait", "", "")
    if (ajaxTime && (Date.now() - ajaxTime) > 30000) {
        //sideex_log.error("Ajax Wait timed out after 30000ms");
        ajaxCount = 0;
        ajaxTime = "";
        return true;
    } else if (response && response.ajax_done) {
        ajaxCount = 0;
        ajaxTime = "";
        return true;
    } else {
        ajaxCount++;
        if (ajaxCount == 1) {
            ajaxTime = Date.now();
            //sideex_log.info("Wait for all ajax requests to be done");
        }
        return await doAjaxWait();
    }
}

async function doDomWait() {
    //console.log("in domWait");
    const response = await extCommand.sendCommand("domWait", "", "")
    if (domTime && (Date.now() - domTime) > 30000) {
        //sideex_log.error("DOM Wait timed out after 30000ms");
        domCount = 0;
        domTime = "";
        return true;
    } else if (response && (Date.now() - response.dom_time) < 400) {
        domCount++;
        if (domCount == 1) {
            domTime = Date.now();
            //sideex_log.info("Wait for the DOM tree modification");
        }
        return await doDomWait();
    } else {
        domCount = 0;
        domTime = "";
        return true;
    }
}

async function doCommand(command) {
    
    let commandName = command.action
    let commandTarget = command.target
    let commandValue = command.value

    //console.log("in common");

    if (implicitCount == 0) {
        if (commandTarget.includes("d-XPath")) {
            //sideex_log.info("Executing: | " + commandName + " | " + getCommandTarget(commands[currentPlayingCommandIndex], true) + " | " + commandValue + " |");
        } else {
            if (commandName !== '#') {
                //sideex_log.info("Executing: | " + commandName + " | " + commandTarget + " | " + commandValue + " |");
            }
        }
    }

    let p = new Promise(function(resolve, reject) {
        let count = 0;
        let interval = setInterval(function() {
            var limit = 30000/10;
            if (count > limit) {
                //sideex_log.error("Timed out after 30000ms");
                reject("Window not Found");
                clearInterval(interval);
            }
            if (!extCommand.getPageStatus()) {
                if (count == 0) {
                    //sideex_log.info("Wait for the new page to be fully loaded");
                }
                count++;
            } else {
                resolve();
                clearInterval(interval);
            }
        }, 10);
    });

    const v1 = await p
    const result = await sendtoCommand(commandName,commandTarget,commandValue)

    if (result.result != "success") {

        var originalCurrentPlayingCommandIndex = currentPlayingCommandIndex;

        // implicit
        if (result.result.match(/Element[\s\S]*?not found/)) {
            if (implicitTime && (Date.now() - implicitTime > 10000)) {
                //sideex_log.error("Implicit Wait timed out after 10000ms");
                implicitCount = 0;
                implicitTime = "";
            } else {
                implicitCount++;
                if (implicitCount == 1) {
                    //sideex_log.info("Wait until the element is found");
                    implicitTime = Date.now();
                }
                return await doCommand(command);
            }
        }

        implicitCount = 0;
        implicitTime = "";
        // KAT-BEGIN
        // document.getElementById("result-failures").textContent = parseInt(document.getElementById("result-failures").textContent) + 1;
        // KAT-END
        if (commandName.includes("verify") && result.result.includes("did not match")) {
            // setColor(currentPlayingCommandIndex + 1, "fail");
        } else {
            // logEndTime();
            //sideex_log.info("Test case failed");
            // caseFailed = true;
            // currentPlayingCommandIndex = commands.length;
        }
        return chrome.runtime.sendMessage({
            captureEntirePageScreenshot: true,
            captureWindowId: extCommand.getContentWindowId()
        }).then(function(captureResponse) {
            addToScreenshot(captureResponse.image, 'fail-' + sideex_testCase[currentTestCaseId].title + '-' + originalCurrentPlayingCommandIndex);
        });
    } else {
        // setColor(currentPlayingCommandIndex + 1, "success");
        // if (result.capturedScreenshot) {
        //     addToScreenshot(result.capturedScreenshot, result.capturedScreenshotTitle);
        // }
    }
}

async function sendtoCommand(commandName,commandTarget,commandValue){
    if (commandName === '#') {
        return {
            result: 'success'
        };
    }
    if (expectingLabel !== null && commandName !== 'label') {
        return {
            result: 'success'
        };
    }
    var originalCommandTarget = commandTarget;
    // in case blockStack is undefined
    if (!blockStack) {
        blockStack = [];
    }
    // get the last block
    var lastBlock;
    if (blockStack.length == 0) {
        lastBlock = undefined;
    } else {
        lastBlock = blockStack[blockStack.length - 1];
    }
    // check if this block is skipped
    var skipped = lastBlock &&
            (lastBlock.dummy ||
            (lastBlock.isLoadVars && lastBlock.done) ||
            (lastBlock.isIf && !lastBlock.condition) ||
            (lastBlock.isWhile && !lastBlock.condition));
    // normal command: just skipped
    if (skipped && (['loadVars', 'endLoadVars', 'if', 'else', 'elseIf', 'endIf', 'while', 'endWhile'].indexOf(commandName) < 0)) {
        return {
            result: 'success'
        };
    } else if (skipped && (['loadVars', 'if', 'while'].indexOf(commandName) >= 0)) {
        // open block commands: push dummy block
        blockStack.push({
            dummy: true
        });
        return {
            result: 'success'
        };
    } else if (skipped && (['endLoadVars', 'endIf', 'endWhile'].indexOf(commandName) >= 0)) {
        // remove dummy block on end
        if (lastBlock.dummy) {
            blockStack.pop();
            return {
                result: 'success'
            };
        }
    } else if (skipped && (['else', 'elseIf'].indexOf(commandName) >= 0)) {
        // intermediate statement: only ignore if inside skipped block
        if (lastBlock.dummy) {
            return {
                result: 'success'
            };
        }
    }
    if(commandValue.indexOf("${") !== -1){
        commandValue = convertVariableToString(commandValue);
    }
    if(commandTarget.indexOf("${") !== -1){
        commandTarget = convertVariableToString(commandTarget);
    }
    if ((commandName === 'storeEval') || (commandName === 'storeEvalAndWait')) {
        commandTarget = expandForStoreEval(commandTarget);
    }
    if (commandName === 'if') {
        var condition = evalIfCondition(commandTarget);
        blockStack.push({
            isIf: true,
            condition: condition,
            met: condition // if block has "true" condition
        });
        return {
            result: 'success'
        };
    }
    if (commandName === 'else') {
        if (lastBlock.met) {
            lastBlock.condition = false;
        } else {
            lastBlock.condition = !lastBlock.condition;
            lastBlock.met = lastBlock.condition;
        }
        return {
            result: 'success'
        };
    }
    if (commandName === 'elseIf') {
        if (lastBlock.met) {
            lastBlock.condition = false;
        } else {
            lastBlock.condition = evalIfCondition(commandTarget);
            lastBlock.met = lastBlock.condition;
        }
        return {
            result: 'success'
        };
    }
    if (commandName === 'endIf') {
        // end block
        blockStack.pop();
        return {
            result: 'success'
        };
    }
    if (commandName === 'while') {
        blockStack.push({
            isWhile: true,
            index: currentPlayingCommandIndex,
            condition: evalIfCondition(commandTarget),
            originalCommandTarget: originalCommandTarget
        });
        return {
            result: 'success'
        };
    }
    if (commandName === 'endWhile') {
        var lastBlockCommandTarget = lastBlock.originalCommandTarget;
        if(lastBlockCommandTarget.indexOf("${") !== -1){
            lastBlockCommandTarget = convertVariableToString(lastBlockCommandTarget);
        }
        lastBlock.condition = evalIfCondition(lastBlockCommandTarget);
        if (lastBlock.condition) {
            // back to while
            currentPlayingCommandIndex = lastBlock.index;
            return {
                result: 'success'
            };
        } else {
            blockStack.pop();
            return {
                result: 'success'
            };
        }
    }
    if (commandName === 'loadVars') {
        // parse once
        var parsedData = parseData(commandTarget);
        var data = parsedData.data;
        var block = {
            isLoadVars: true,
            index: currentPlayingCommandIndex,
            currentLine: 0, // line of data
            data: data,
            type: parsedData.type,
            done: data.length == 0 // done if empty file
        };
        blockStack.push(block);
        if (!block.done) { // if not done get next line
            var line = block.data[block.currentLine];
            $.each(line, function(key, value) {
                declaredVars[key] = value;
            });
        }
        return {
            result: 'success'
        };
    }
    if (commandName === 'endLoadVars') {
        // next data line
        lastBlock.currentLine++;
        lastBlock.done = lastBlock.currentLine >= lastBlock.data.length; // out of data
        if (lastBlock.done) {
            blockStack.pop(); // quit block
        } else {
            currentPlayingCommandIndex = lastBlock.index; // back to command after while
            var line = lastBlock.data[lastBlock.currentLine] // next data
            $.each(line, function(key, value) {
                declaredVars[key] = value;
            });
        }
        return {
            result: 'success'
        };
    }
    if (commandName === 'label') {
        var label = currentTestCaseId + '-' + commandTarget;
        labels[label] = currentPlayingCommandIndex;
        if (expectingLabel === label) {
            expectingLabel = null;
        }
        return {
            result: 'success'
        };
    }
    if (commandName === 'gotoIf') {
        if (evalIfCondition(commandTarget)) {
            var label = currentTestCaseId + '-' + commandValue;
            var jumpTo = labels[label];
            if (jumpTo === undefined) {
                expectingLabel = label;
            } else {
                currentPlayingCommandIndex = jumpTo;
            }
            return {
                result: 'success'
            };
        } else {
            return {
                result: 'success'
            };
        }
    }
    if (commandName === 'gotoLabel') {
        var label = currentTestCaseId + '-' + commandTarget;
        var jumpTo = labels[label];
        if (jumpTo === undefined) {
            expectingLabel = label;
        } else {
            currentPlayingCommandIndex = jumpTo;
        }
        return {
            result: 'success'
        };
    }
    if (commandName === 'storeCsv') {
        var tokens = commandTarget.split(',');
        var csvValue = parseData(tokens[0]).data[parseInt(tokens[1])][tokens[2]];
        //sideex_log.info("Store '" + csvValue + "' into '" + commandValue + "'");
        declaredVars[commandValue] = csvValue;
        return {
            result: 'success'
        };
    }
    if (isWindowMethodCommand(commandName))
    {
        return await extCommand.sendCommand(commandName, commandTarget, commandValue, true);
    }
    return await extCommand.sendCommand(commandName, commandTarget, commandValue);
}

function isReceivingEndError(reason) {
    if (reason == "TypeError: response is undefined" ||
        reason == "Error: Could not establish connection. Receiving end does not exist." ||
        // Below message is for Google Chrome
        reason.message == "Could not establish connection. Receiving end does not exist." ||
        // Google Chrome misspells "response"
        reason.message == "The message port closed before a reponse was received." ||
        reason.message == "The message port closed before a response was received." )
        return true;
    return false;
}

function isWindowMethodCommand(command) {
    if (command == "answerOnNextPrompt"
        || command == "chooseCancelOnNextPrompt"
        || command == "assertPrompt"
        || command == "chooseOkOnNextConfirmation"
        || command == "chooseCancelOnNextConfirmation"
        || command == "assertConfirmation"
        || command == "assertAlert")
        return true;
    return false;
}

function enableButton(buttonId) {
    document.getElementById(buttonId).disabled = false;
}

function disableButton(buttonId) {
    document.getElementById(buttonId).disabled = true;
}

function convertVariableToString(variable){
    var originalVariable = variable;
    let frontIndex = variable.indexOf("${");
    let newStr = "";
    while(frontIndex !== -1){
        let prefix = variable.substring(0,frontIndex);
        let suffix = variable.substring(frontIndex);
        let tailIndex = suffix.indexOf("}");
        if (tailIndex >= 0) {
            let suffix_front = suffix.substring(0,tailIndex + 1);
            let suffix_tail = suffix.substring(tailIndex + 1);
            newStr += prefix + xlateArgument(suffix_front);
            variable = suffix_tail;
            frontIndex = variable.indexOf("${");
        } else {
            // e.g. ${document https://forum.katalon.com/discussion/6083
            frontIndex = -1;
        }
    }
    var expanded = newStr + variable;
    //sideex_log.info("Expand variable '" + originalVariable + "' into '" + expanded + "'");
    return expanded;
}
