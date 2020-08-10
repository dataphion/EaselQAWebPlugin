// admin.dataphion.com
// login: "https://admin.dataphion.com/auth/local",

export function giveUrl(endpoint) {
  console.log("url function called --->");
  // return "value";
  return new Promise(function(resolve, reject) {
    chrome.storage.sync.get(["is_host_registered", "hostname"], result => {
      console.log("hostname ---->", result);
      let host = "";
      if (endpoint === "login") {
        host = `https://${result.hostname}/auth/local`;
        resolve(host);
      } else if (endpoint === "strapi_url_graphql") {
        host = `https://${result.hostname}/graphql`;
        resolve(host);
      } else if (endpoint === "strapi_url") {
        host = `https://${result.hostname}`;
        resolve(host);
      } else if (endpoint === "vision_url") {
        host = `https://${result.hostname}/vision`;
        resolve(host);
      } else if (endpoint === "googleVision_url") {
        host = `https://${result.hostname}/vision/api/PageOCR`;
        resolve(host);
      }
    });
  });
}
