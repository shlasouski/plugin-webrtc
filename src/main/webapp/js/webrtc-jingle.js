WebRtcJingle = function() {
	this.remoteOffer = null;
	this.localStream = null;
	this.callback = null;
	this.pc = null;
	this.sid = null;
	this.farParty = null;
	this.interval = null;
	this.inviter = false;
	this.peerConfig = null;
	this.jid = null;
	this.candidates = new Array();
	this.trickleICE = false;
}
if (typeof webkitRTCPeerConnection == "function") {
	WebRtcJingle.GUM = function(p, s, f) {
		navigator.webkitGetUserMedia(p, s, f)
	};
	WebRtcJingle.mkPeerConnection = function(a, b) {
		return new webkitRTCPeerConnection(a, b);
	};
	WebRtcJingle.mkSessionDescription = function(a) {
		return new RTCSessionDescription(a);
	};
	WebRtcJingle.createObjectURL = function(s) {
		return webkitURL.createObjectURL(s);
	};
	WebRtcJingle.stun = "stun:stun.l.google.com:19302";
	WebRtcJingle.attachMediaStream = function(element, stream) {
		element.src = webkitURL.createObjectURL(stream);
	};
	WebRtcJingle.AudioUrl = function(url) {
		return url;
	};
	WebRtcJingle.addCreateConstraint = function(constraint) {
		return constraint;
	};
	WebRtcJingle.IceCandidate = function(candidate) {
		return new RTCIceCandidate(candidate);
	};
} else if (typeof mozRTCPeerConnection == "function") {
	WebRtcJingle.GUM = function(p, s, f) {
		navigator.mozGetUserMedia(p, s, f)
	};
	WebRtcJingle.mkPeerConnection = function(a, b) {
		return new mozRTCPeerConnection(a, b);
	};
	WebRtcJingle.mkSessionDescription = function(a) {
		return new mozRTCSessionDescription(a);
	};
	WebRtcJingle.createObjectURL = function(s) {
		return URL.createObjectURL(s);
	};
	WebRtcJingle.stun = "stun:23.21.150.121";
	WebRtcJingle.attachMediaStream = function(element, stream) {
		element.mozSrcObject = stream;
		element.play();
	};
	WebRtcJingle.AudioUrl = function(url) {
		return url.replace(".mp3", ".ogg");
	};
	WebRtcJingle.addCreateConstraint = function(constraint) {
		constraint.mandatory.MozDontOfferDataChannel = true;
		return constraint;
	};
	WebRtcJingle.IceCandidate = function(candidate) {
		return new mozRTCIceCandidate(candidate);
	};
}
WebRtcJingle.media = {
	audio : true,
	video : true
};
WebRtcJingle.constraints = {
	'mandatory' : {
		'OfferToReceiveAudio' : WebRtcJingle.media.audio,
		'OfferToReceiveVideo' : WebRtcJingle.media.video
	}
};
WebRtcJingle.peerconstraints = {
	'optional' : [ {
		'DtlsSrtpKeyAgreement' : 'true'
	} ]
};
WebRtcJingle.offerconstraints = WebRtcJingle
		.addCreateConstraint(WebRtcJingle.constraints);
WebRtcJingle.prototype.startApp = function(callback, peerConfig) {
	// console.log("startApp");
	this.callback = callback;
	this.peerConfig = peerConfig;
	this.getUserMedia();
}
WebRtcJingle.prototype.startScreenShare = function(callback, peerConfig) {
	// console.log("startScreenShare");
	this.callback = callback;
	this.peerConfig = peerConfig;
	this.getScreenMedia();
}
WebRtcJingle.prototype.stopApp = function() {
	// console.log("stopApp");
	this.jingleTerminate();
	if (this.pc != null)
		this.pc.close();
	this.pc = null;
}
WebRtcJingle.prototype.getUserMedia = function() {
	// console.log("getUserMedia");
	WebRtcJingle.GUM(WebRtcJingle.media, this.onUserMediaSuccess.bind(this),
			this.onUserMediaError.bind(this));
}
WebRtcJingle.prototype.getScreenMedia = function() {
	// console.log("getScreenMedia");
	WebRtcJingle.GUM({
		video : {
			mandatory : {
				chromeMediaSource : 'screen'
			}
		}
	}, this.onUserMediaSuccess.bind(this), this.onUserMediaError.bind(this));
}
WebRtcJingle.prototype.onUserMediaSuccess = function(stream) {
	// console.log("onUserMediaSuccess ");
	this.localStream = stream;
	if (this.callback != null) {
		this.callback.startLocalMedia(stream);
	}
}
WebRtcJingle.prototype.onUserMediaError = function(error) {
	// console.log("onUserMediaError " + error.code);
}
WebRtcJingle.prototype.onMessage = function(packet) {
	// console.log("webrtc - onMessage");
	// console.log(packet);
	var elem = this.textToXML(packet);
	if (elem.nodeName == "iq") {
		if (elem.getAttribute("type") == "result") {
			var channels = elem.getElementsByTagName("channel");
			if (channels.length > 0) {
				var relayHost = channels[0].getAttribute("host");
				var relayLocalPort = channels[0].getAttribute("localport");
				var relayRemotePort = channels[0].getAttribute("remoteport");
				// console.log("add JingleNodes candidate: " + relayHost + " " +
				// relayLocalPort + " " + relayRemotePort);
				this.sendTransportInfo("0",
						"a=candidate:3707591233 1 udp 2113937151 " + relayHost
								+ " " + relayRemotePort
								+ " typ host generation 0");
				var candidate = WebRtcJingle.IceCandidate({
					sdpMLineIndex : "0",
					candidate : "a=candidate:3707591233 1 udp 2113937151 "
							+ relayHost + " " + relayLocalPort
							+ " typ host generation 0"
				});
				this.pc.addIceCandidate(candidate);
			}
		} else if (elem.getAttribute("type") != "error") {
			var jingle = elem.firstChild;
			this.sid = jingle.getAttribute("sid");
			if (jingle.nodeName == "jingle"
					&& jingle.getAttribute("action") != "session-terminate") {
				if (this.pc == null) {
					this.createPeerConnection();
				}
				if (jingle.getAttribute("action") == "transport-info") {
					if (jingle.getElementsByTagName("candidate").length > 0) {
						var candidate = jingle
								.getElementsByTagName("candidate")[0];
						var ice = {
							sdpMLineIndex : candidate.getAttribute("label"),
							candidate : candidate.getAttribute("candidate")
						};
						var iceCandidate = WebRtcJingle.IceCandidate(ice);
						if (this.farParty == null) {
							this.candidates.push(iceCandidate);
						} else {
							this.pc.addIceCandidate(iceCandidate);
						}
					}
				} else {
					if (jingle.getElementsByTagName("webrtc").length > 0) {
						var sdp = jingle.getElementsByTagName("webrtc")[0].firstChild.data;
						if (jingle.getAttribute("action") == "session-initiate") {
							this.inviter = false;
							this.remoteOffer = WebRtcJingle
									.mkSessionDescription({
										type : "offer",
										sdp : sdp
									});
							if (this.callback != null) {
								this.callback.incomingCall(elem
										.getAttribute("from"));
							}
						} else {
							this.inviter = true;
							this.pc.setRemoteDescription(WebRtcJingle
									.mkSessionDescription({
										type : "answer",
										sdp : sdp
									}));
							this.addJingleNodesCandidates();
						}
					}
				}
			} else {
				this.doCallClose();
			}
		}
	}
}
WebRtcJingle.prototype.acceptCall = function(farParty) {
	// console.log("acceptCall");
	this.farParty = farParty;
	this.pc.setRemoteDescription(this.remoteOffer);
}
WebRtcJingle.prototype.onConnectionClose = function() {
	// console.log("webrtc - onConnectionClose");
	this.doCallClose();
}
WebRtcJingle.prototype.jingleInitiate = function(farParty) {
	// console.log("jingleInitiate " + farParty);
	this.farParty = farParty;
	this.inviter = true;
	this.sid = "webrtc-initiate-" + Math.random().toString(36).substr(2, 9);
	this.createPeerConnection();
	if (this.pc != null) {
		var webrtc = this;
		this.pc.createOffer(function(desc) {
			webrtc.pc.setLocalDescription(desc);
			if (webrtc.trickleICE)
				webrtc.sendJingleIQ(desc.sdp);
		}, null, WebRtcJingle.offerconstraints);
	}
}
WebRtcJingle.prototype.jingleTerminate = function() {
	// console.log("jingleTerminate");
	this.sendJingleTerminateIQ()
	this.doCallClose();
}
WebRtcJingle.prototype.doCallClose = function() {
	if (this.pc != null)
		this.pc.close();
	this.pc = null;
	this.farParty = null;
	if (this.callback != null) {
		this.callback.terminatedCall();
	}
}
WebRtcJingle.prototype.createPeerConnection = function() {
	// console.log("createPeerConnection");
	this.pc = WebRtcJingle.mkPeerConnection(this.peerConfig,
			WebRtcJingle.peerconstraints);
	this.pc.onicecandidate = this.onIceCandidate.bind(this);
	this.pc.onstatechange = this.onStateChanged.bind(this);
	this.pc.onopen = this.onSessionOpened.bind(this);
	this.pc.onaddstream = this.onRemoteStreamAdded.bind(this);
	this.pc.onremovestream = this.onRemoteStreamRemoved.bind(this);
	this.pc.addStream(this.localStream);
	this.candidates = new Array();
}
WebRtcJingle.prototype.onIceCandidate = function(event) {
	// console.log("onIceCandidate");
	while (this.candidates.length > 0) {
		var candidate = this.candidates.pop();
		// console.log("Retrieving candidate " + candidate.candidate);
		this.pc.addIceCandidate(candidate);
	}
	if (event.candidate) {
		if (this.trickleICE)
			this.sendTransportInfo(event.candidate.sdpMLineIndex,
					event.candidate.candidate);
	} else {
		if (this.trickleICE == false)
			webrtc.sendJingleIQ(this.pc.localDescription.sdp);
	}
}
WebRtcJingle.prototype.sendTransportInfo = function(sdpMLineIndex, candidate) {
	// console.log("sendTransportInfo");
	var id = "webrtc-jingle-" + Math.random().toString(36).substr(2, 9);
	var jingleIq = "<iq type='set' to='" + this.farParty + "' id='" + id + "'>";
	jingleIq = jingleIq
			+ "<jingle xmlns='urn:xmpp:jingle:1' action='transport-info' initiator='"
			+ this.jid + "' sid='" + this.sid + "'>";
	jingleIq = jingleIq
			+ "<transport xmlns='http://phono.com/webrtc/transport'><candidate label='"
			+ sdpMLineIndex + "' candidate='" + candidate
			+ "' /></transport></jingle></iq>";
	this.callback.sendPacket(jingleIq);
}
WebRtcJingle.prototype.onSessionOpened = function(event) {
	// console.log("onSessionOpened");
	// console.log(event);
}
WebRtcJingle.prototype.onRemoteStreamAdded = function(event) {
	// console.log("onRemoteStreamAdded ");
	// console.log(event);
	if (this.inviter == false) {
		var webrtc = this;
		this.pc.createAnswer(function(desc) {
			webrtc.pc.setLocalDescription(desc);
			if (webrtc.trickleICE)
				webrtc.sendJingleIQ(desc.sdp);
		}, null, WebRtcJingle.constraints);
	}
	if (this.callback != null) {
		this.callback.startRemoteMedia(event.stream, this.farParty);
	}
}
WebRtcJingle.prototype.onRemoteStreamRemoved = function(event) {
	// console.log("onRemoteStreamRemoved ");
	// console.log(event);
}
WebRtcJingle.prototype.onStateChanged = function(event) {
	// console.log("onStateChanged");
	// console.log(event);
}
WebRtcJingle.prototype.sendJingleTerminateIQ = function() {
	if (this.callback != null) {
		var id = "webrtc-jingle-" + Math.random().toString(36).substr(2, 9);
		var jIQ = "<iq type='set' to='" + this.farParty + "' id='" + id + "'>";
		jIQ = jIQ
				+ "<jingle xmlns='urn:xmpp:jingle:1' action='session-terminate' initiator='"
				+ this.jid + "' sid='" + this.sid + "'>";
		jIQ = jIQ + "<reason><success/></reason></jingle></iq>"
		this.callback.sendPacket(jIQ);
	}
}
WebRtcJingle.prototype.sendJingleIQ = function(sdp) {
	if (this.callback == null) {
		return;
	}
	// console.log("sendJingleIQ");
	// console.log(sdp);
	var action = this.inviter ? "session-initiate" : "session-accept";
	var iq = "";
	var id = "webrtc-jingle-" + Math.random().toString(36).substr(2, 9);
	iq += "<iq type='set' to='" + this.farParty + "' id='" + id + "'>";
	iq += "<jingle xmlns='urn:xmpp:jingle:1' action='" + action
			+ "' initiator='" + this.jid + "' sid='" + this.sid + "'>";
	iq += "<webrtc xmlns='http://webrtc.org'>" + sdp + "</webrtc>";
	iq += "</jingle></iq>";
	this.callback.sendPacket(iq);
}
WebRtcJingle.prototype.textToXML = function(text) {
	var doc = null;
	if (window['DOMParser']) {
		var parser = new DOMParser();
		doc = parser.parseFromString(text, 'text/xml');
	} else if (window['ActiveXObject']) {
		var doc = new ActiveXObject("MSXML2.DOMDocument");
		doc.async = false;
		doc.loadXML(text);
	} else {
		throw Error('No DOMParser object found.');
	}
	return doc.firstChild;
}
WebRtcJingle.prototype.addJingleNodesCandidates = function() {
	// console.log("addJingleNodesCandidates");
	var iq = "";
	var id = "jingle-nodes-" + Math.random().toString(36).substr(2, 9);
	iq += "<iq type='get' to='" + "relay." + window.location.hostname
			+ "' id='" + id + "'>";
	iq += "<channel xmlns='http://jabber.org/protocol/jinglenodes#channel' protocol='udp' />";
	iq += "</iq>";
	this.callback.sendPacket(iq);
}
