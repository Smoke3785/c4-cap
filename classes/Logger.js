const { EventEmitter } = require("events");
const chalk = require("chalk");
const art = require("ascii-art");

const typeColors = {
  standard: "white",
  main: "blue",
  warning: "yellow",
  error: "red",
  other: "magenta",
  notify: "magenta",
  service: "green",
};

const typePrefixes = {
  warning: " Warning:",
  error: "Error:",
  standard: "",
  notify: "",
};

class Logger extends EventEmitter {
  constructor(mainProcess) {
    super();
    this.mainProcess = mainProcess;
  }

  log(source = "Anonymous", type, ...args) {
    let padding = ["Anonymous", "Main"].includes(source) ? " " : " ";
    let formattedSource = this.formatSource(source);
    let colorKey = this.getColorKey(type, source);
    let timestamp = this.getTimestamp();

    let finalFormatted =
      timestamp + chalk[colorKey[0]](`${padding}[${formattedSource}]`);

    console.log(
      finalFormatted,
      chalk[colorKey[1]](typePrefixes[type]),
      chalk[colorKey[1]](...args)
    );
  }

  getColorKey(type = "other", source) {
    if (!typeColors[type]) {
      throw new Error(`Tried to log an unregistered message type ${type}`);
    }

    let t = typeColors[type];
    let s = "Main" ? typeColors.main : typeColors.service;

    if (!chalk[t]) {
      throw new Error(`No chalk color of key ${t}`);
    }

    return [s, t];
  }

  getTimestamp(showDate = false) {
    var date = new Date();

    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hour = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();

    month = (month < 10 ? "0" : "") + month;
    day = (day < 10 ? "0" : "") + day;
    hour = (hour < 10 ? "0" : "") + hour;
    min = (min < 10 ? "0" : "") + min;
    sec = (sec < 10 ? "0" : "") + sec;

    var str =
      date.getFullYear() +
      "-" +
      month +
      "-" +
      day +
      "_" +
      hour +
      ":" +
      min +
      ":" +
      sec;

    return showDate ? str : str.split("_")[1];
  }

  formatSource(inputString, targetLength = 10) {
    if (inputString.length < targetLength) {
      while (inputString.length < targetLength) {
        inputString = " " + inputString;
      }
    }
    if (inputString.length > targetLength) {
      inputString = inputString.slice(0, targetLength - 3) + "...";
    }

    return inputString;
  }

  async welcome() {}
}

module.exports = Logger;
