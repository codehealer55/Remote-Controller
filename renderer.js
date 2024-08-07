const serverURL = "https://ns-server.vantagemdm.com";
const mdmServerURL = "https://ns-mdm.vantagemdm.com:8553/mdm";
const phpUrl = "ns-cp.vantagemdm.com";
const deviceKey = "mikhioekobmenlckiimcmmjbomcgcigm";
const resellerId = "VantageMDM";
const buildVersion = "CHROME-R-1.0.6";
const ChromeVersion = (/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [
  ,
  0,
])[1];
const agent = "screenSharing";
const platform = "chrome";
const browser = "Chrome";
/*** WEB SERVICES ****/
const socketUrl = "https://p2p.vantagemdm.com:8890";
const signUpUrl = serverURL + "/secure/device/subscribe";
const subcribeUrl = serverURL + "/secure/mdm/validate/user";
const fileUploadUrl = serverURL + "/secure/upload/file";
const getSettingsUrl = mdmServerURL + "/get/device/settings";
const getCallBackUrl =
  mdmServerURL + "/commands/status/completed?productName=" + resellerId;
let socket;
let mappingid = null;
let iceServers = [];
let inCandidates = [];
let outCandidates = [];
let connection = null;
let answerReceived = false;
let viewer = null;
let message = null;
let stream = null;
let mediaStream = null;
let streamstatus = null;
let canvas;
let canvasStream;
let currentStream;
let videoElm;
let isSeted;
let currentDesktopState;

document.addEventListener("DOMContentLoaded", () => {
  getUserMediaStream();
  window.api.getItem("VantageMDMScreenCastingConnect").then((data) => {
    console.log(data);
    if (data === true) {
      //Canvas Stream

      // videoElm = document.getElementById("vid");
      // // getUserMediaStream();
      // videoElm.srcObject = mediaStream;
      // finalStream = videoElm.captureStream();
      connect();
    }
  });
  // initStreaming();
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  window.api.getItem("screensharing").then((data) => {
    console.log(data);
    if (data === "start") {
      startButton.disabled = true;
      // initStreaming();
      startStreaming();
    } else stopButton.disabled = true;
  });
  const connectButton = document.getElementById("connectBtn");
  if (connectButton) {
    connectButton.addEventListener("click", async () => {
      let jsonData = "";
      let jsonObject = {
        userName: "",
        password: document.getElementById("serialKey").value,
        resellerId: "VantageMDM",
        deviceKey: deviceKey,
        platform: platform,
        productVersion: buildVersion,
        productName: resellerId,
        timeZoneOffset: 0,
        udid: deviceKey,
        ChromeVersion: ChromeVersion,
        serial: ChromeVersion,
        agent: agent,
        browser: browser,
      };
      const formData = JSON.stringify(jsonObject);
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
      const urlencoded = new URLSearchParams();
      urlencoded.append("formData", formData);
      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow",
      };
      jsonData = {
        mappingId: "a1f5f7dc-0c08-4396-b0b5-1a49bf234ae6",
        code: "100",
        screenCastingURL:
          "https://ippcscreenshot2.vantagemdm.com/screen/hmuwti",
        rtmpUrl: undefined,
        deviceId: undefined,
        mdmUrl: undefined,
        deviceName: undefined,
        deviceKey: "8745BC73B35AB04AA787C1553CC9D386",
        productVersion: buildVersion,
        protocol: "wss",
        port: 443,
        host: "streaming.vantagemdm.com",
        streamMode: "live",
        companyUrl: "ippcscreenshot2.vantagemdm.com",
        companyName: "ippcscreenshot2",
      };
      await window.api.setItem("mappingData", JSON.stringify(jsonData));
      await window.api.setItem("mappingId", jsonData.mappingId);
      await window.api.setItem("deviceKey", jsonData.deviceKey);
      await window.api.setItem("VantageMDMScreenCastingConnect", true);
      window.api.getItem("mappingData").then((data) => {
        console.log("mappingData:", JSON.parse(data));
      });
      window.api.getItem("mappingId").then((data) => {
        console.log("mappingId:", data);
      });
      window.api.getItem("deviceKey").then((data) => {
        console.log("deviceKey:", data);
      });
      window.api.getItem("VantageMDMScreenCastingConnect").then((data) => {
        console.log("VantageMDMScreenCastingConnect:", data);
      });
      window.api.loadOtherHtml("main.html");
    });
  }
  if (startButton) {
    startButton.addEventListener("click", async () => {
      console.log("start");
      initStreaming();
      startStreaming();
      window.api.setItem("screensharing", "start");
      startButton.disabled = true;
      stopButton.disabled = false;
    });
  }
  if (stopButton) {
    stopButton.addEventListener("click", async () => {
      console.log("stop");
      window.api.setItem("screensharing", "stop");
      startButton.disabled = false;
      stopButton.disabled = true;
      stopStreaming();
    });
  }
});

function changeStream() {
  if (connection) {
    getUserMediaStream();
    console.log(currentDesktopState);
    const senders = connection.getSenders();
    // console.log(senders);
    let newTracks;
    // const newTracks = mediaStream.getTracks();
    if (currentDesktopState === "Default") newTracks = mediaStream.getTracks();
    else {
      newTracks = canvasStream.getTracks();
    }
    senders.forEach((sender, index) => {
      sender.replaceTrack(newTracks[index]);
    });
  }
}

function connect(callback) {
  window.api.getItem("mappingId").then((data) => {
    mappingid = data;
  });
  socket = new io(socketUrl, {
    query: "mappingId=" + mappingid,
    secure: true,
    transports: ["websocket"],
  });
  socket.on("connect", () => {
    console.log("Connected to socket.io server");
  });
  setInterval(() => {
    try {
      socket.emit("/v1/alive");
    } catch (e) {
      console.error("Ping error:", e);
    }
  }, 10000);
  socket.on("reconnect_error", () => {
    setTimeout(() => {
      socket.connect();
    }, 1000);
  });
  socket.on("error", (error) => {
    socket.close();
    console.error("Can't connect to socket", error);
  });
  socket.on("connect_error", (error) => {
    socket.close();
    alert(
      "Please check your device internet connection and turn on the stream again. If the problem still persists, please contact our support."
    );
    console.error("Can't connect to socket:", error);
  });
  socket.on("disconnect", (error) => {
    console.log("Disconnected:", error);
    socket.close();
    setTimeout(() => {
      socket.connect();
    }, 1000);
  });
  socket.on("/v1/ready", (response) => {
    iceServers = response.iceServers;
    console.log("Connection is ready to use", iceServers);
    if (callback) callback();
  });
  socket.on("/v1/stream/start", (response) => {
    stream = response.stream;
  });
  socket.on("/v1/stream/destroy", (response) => {
    //Do something
  });
  socket.on("/v1/stream/joined", (response) => {
    onStreamJoin(response);
  });
  socket.on("/v1/stream/leaved", (response) => {
    viewer = null;
    onStreamLeave(response);
  });
  socket.on("/v1/sdp/peer_ice", (response) => {
    onIncomingICE(response);
  });
  socket.on("/v1/error", (response) => {
    //Do something
  });
}
function onStreamJoin(data) {
  console.log("stream joined");
  console.log(data.sdpAnswer);
  stream = data.stream;
  viewer = true;
  connection
    .setRemoteDescription(data.sdpAnswer)
    .then(() => {
      answerReceived = true;
      console.log(answerReceived);
      for (let i in inCandidates) {
        if (inCandidates[i].candidate) {
          const candidate = new RTCIceCandidate(inCandidates[i]);
          connection.addIceCandidate(candidate);
        }
      }
      for (let i in outCandidates) {
        const data = { stream: stream, message: outCandidates[i] };
        socket.emit("/v1/sdp/ice", data);
      }
    })
    .catch((e) => {
      console.log("error on streamJoin", e);
    });
}
function onIncomingICE(response) {
  console.log("incoming ice");
  console.log(answerReceived);
  if (answerReceived) {
    if (response.message.candidate) {
      const candidate = new RTCIceCandidate(response.message);
      connection.addIceCandidate(candidate);
    }
  } else {
    if (!inCandidates) {
      inCandidates = [];
    }
    inCandidates.push(response.message);
  }
  console.log(inCandidates);
}
function onStreamLeave() {
  // startStreaming();
}
function startStreaming() {
  function readAndLogFile() {
    const filePath = "C:\\state";
    window.api
      .readFile(filePath)
      .then((result) => {
        if (currentDesktopState !== result || isSeted !== true) {
          if (result === "Default") {
            getUserMediaStream();

            imgElement = document.getElementById("image");
            canvasElement = document.getElementById("stream");
            if (imgElement && canvasElement) {
              imgElement.remove();
              canvasElement.remove();
            }

            if (mediaStream !== null) isSeted = true;
            currentDesktopState = result;
          } else if (result === "Secure") {
            console.log("secure");
            currentDesktopState = result;

            const contentDiv = document.querySelector(".content");

            // Create the img element
            const imgElement = document.createElement("img");
            imgElement.id = "image";
            imgElement.width = 600;
            imgElement.height = 400;
            imgElement.src = "http://localhost:9876/video_feed";
            imgElement.style.display = "block";

            // Create the canvas element
            const canvasElement = document.createElement("canvas");
            canvasElement.id = "stream";
            canvasElement.width = 1600;
            canvasElement.height = 900;
            canvasElement.style.display = "block";

            // Append the img and canvas elements to the div
            contentDiv.appendChild(imgElement);
            contentDiv.appendChild(canvasElement);

            canvas = document.getElementById("stream");
            canvasStream = canvas.captureStream(30);
            const context = canvas.getContext("2d");
            const img = document.getElementById("image");
            img.onload = () => {
              context.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            setInterval(() => {
              context.drawImage(img, 0, 0, canvas.width, canvas.height);
              context.font = "48px serif";
              context.textAlign = "center";
              context.textBaseline = "middle";
              context.fillStyle = "black";
              context.fillText(
                "Hello, Canvas!",
                canvas.width / 2,
                canvas.height / 2
              );
            }, 1000 / 60);
            if (canvasStream !== null) isSeted = true;
          }
          changeStream();
        }
        // Update the DOM or perform other actions with the result if needed
      })
      .catch((error) => {
        console.error("Error reading file:", error);
      });
  }
  setInterval(readAndLogFile, 33);
  this.connect((err) => {
    answerReceived = false;
    if (connection) {
      connection.close();
    }
    inCandidates = [];
    outCandidates = [];
    const configuration = {
      iceServers: [
        {
          urls: "stun:p2p.vantagemdm.com:3478",
        },
        {
          urls: "turn:p2p.vantagemdm.com:3478",
          username: "test", // Replace with your TURN server username
          credential: "123", // Replace with your TURN server credential
        },
      ],
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    };

    const constraints = {
      optional: [
        { googCpuOveruseDetection: true },
        { googCpuOveruseThreshold: 95 },
      ],
    };

    connection = new RTCPeerConnection(configuration, constraints);
    // console.log(currentDesktopState);
    if (currentDesktopState === "Default") {
      mediaStream.getTracks().forEach((track) => {
        // track.contentHint = "screenshare";
        connection.addTrack(track, mediaStream);
        // console.log(track);
      });
    } else {
      canvasStream.getTracks().forEach((track) => {
        // track.contentHint = "screenshare";
        connection.addTrack(track, canvasStream);
        // console.log(track);
      });
    }
    // connection.oniceconnectionstatechange = async () => {
    //   if (connection.iceConnectionState === "connected") {
    //     console.log("iceconnection changed");
    //     const sender = connection
    //       .getSenders()
    //       .find((s) => s.track.kind === "video");
    //     const parameters = sender.getParameters();

    //     // Set max bitrate and keyframe interval
    //     parameters.encodings[0] = {
    //       maxBitrate: 1000000, // 500 kbps
    //       maxFramerate: 24, // 15 FPS
    //       keyFrameInterval: 48, // Keyframe every 2 seconds (15 FPS * 2)
    //     };

    //     await sender.setParameters(parameters);
    //   }
    // };
    connection.onicecandidate = (event) => {
      // console.log(event.candidate);
      if (event.candidate) {
        console.log("on ice candidate");
        if (answerReceived) {
          console.log("new ice candidate");
          const data = { stream: this.stream, message: event.candidate };
          socket.emit("/v1/sdp/ice", data);
        } else {
          outCandidates.push(event.candidate);
        }
      }
    };
    connection
      .createOffer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
      })
      .then(
        (desc) => {
          desc.sdp = desc.sdp.replace(
            /a=mid:video\r\n/g,
            "a=mid:video\r\nb=AS:256\r\n"
          );
          connection.setLocalDescription(desc);
          let data = { client: mappingid, stream: this.stream, sdpOffer: desc };
          socket.emit("/v1/stream/start", data);
          message = "waiting";
        },
        (error) => {
          console.log("Error in Create offer, desc.sdp", error);
        }
      );
    // mediaStream.getVideoTracks()[0].addEventListener("ended", () => {
    //   stopStreaming();
    //   console.log("stop1");
    // });
    // mediaStream.oninactive = () => {
    //   if (viewer == true) {
    //     console.log("inactive");
    //     initStreaming();
    //     startStreaming();
    //   }
    // };
  });
}

// function preferCodec(sdp, codec) {
//   const sdpLines = sdp.split("\r\n");
//   let mLineIndex = -1;

//   // Find the m-line for video
//   for (let i = 0; i < sdpLines.length; i++) {
//     if (sdpLines[i].startsWith("m=video")) {
//       mLineIndex = i;
//       break;
//     }
//   }

//   if (mLineIndex === -1) {
//     return sdp;
//   }

//   // Find the payload types for the codec
//   const codecRegex = new RegExp(`a=rtpmap:(\\d+) ${codec}/90000`, "i");
//   const payloadTypes = [];

//   for (let i = 0; i < sdpLines.length; i++) {
//     const match = sdpLines[i].match(codecRegex);
//     if (match) {
//       payloadTypes.push(match[1]);
//     }
//   }

//   if (payloadTypes.length === 0) {
//     return sdp;
//   }

//   // Modify the m-line to set the codec as the first one
//   const mLineElements = sdpLines[mLineIndex].split(" ");
//   const newMLine = [
//     mLineElements[0],
//     mLineElements[1],
//     mLineElements[2],
//     ...payloadTypes,
//     ...mLineElements.slice(3),
//   ].join(" ");

//   sdpLines[mLineIndex] = newMLine;

//   return sdpLines.join("\r\n");
// }

function stopStreaming() {
  console.log(connection);
  //console.log(canvasStream);
  if (connection) connection.close();
  window.api.getItem("screensharing").then((data) => {
    console.log(data);
  });
  if (connection && viewer === false) {
    connection.close();
    console.log("connection closed");
  }
  message = "done";
  // viewer = null;
  let data = "";
  data = { stream: this.stream };
  socket.emit("/v1/stream/destroy", data);
}
function initStreaming() {
  socket.close();
  connect();
}

window.api.onBmpData((bmpData) => {
  //   const videoTracks = canvasStream.getVideoTracks();
  //   const audioTracks = canvasStream.getAudioTracks();
  //   if (videoTracks.length > 0) {
  //     console.log(`Using video device: ${videoTracks[0].label}`);
  //   }
  //   if (audioTracks.length > 0) {
  //     console.log(`Using audio device: ${audioTracks[0].label}`);
  //   }
  // }
  // canvas = document.getElementById("stream");
  // const context = canvas.getContext("2d");
  // if (bmpData) {
  //   const binaryString = atob(bmpData);
  //   const len = binaryString.length;
  //   const bytes = new Uint8Array(len);
  //   for (let i = 0; i < len; i++) {
  //     bytes[i] = binaryString.charCodeAt(i);
  //   }
  //   const blob = new Blob([bytes.buffer], { type: "image/bmp" });
  //   const url = URL.createObjectURL(blob);
  //   const img = new Image();
  //   img.src = url;
  //   img.onload = () => {
  //     context.drawImage(img, 0, 0, canvas.width, canvas.height);
  //   };
  // }
});

function getUserMediaStream() {
  window.api
    .getStream()
    .then((streamID) => {
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: streamID,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080,
          },
        },
      });
    })
    .then((stream) => {
      mediaStream = stream;
      // const videoElement = document.getElementById("vid");
      // videoElement.srcObject = stream;
    })
    .catch((error) => {
      console.error("Error getting stream:", error);
    });
}
