import { useEffect, useRef, useState } from "react";







import "./App.css";










import AdminDashboard from "./AdminDashboard";


import AssistantChat from "./AssistantChat";


import IssueMap from "./IssueMap";






const API_URL = "https://civiceye-ai-m1cw.onrender.com";








function App() {







  const [showLogin, setShowLogin] = useState(false);







  const [showSignup, setShowSignup] = useState(false);







  const [showReport, setShowReport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
const submitLockRef = useRef(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);















  const [user, setUser] = useState(







    JSON.parse(localStorage.getItem("user")) || null







  );



  const [showAssistantPage, setShowAssistantPage] = useState(false);















  // NOTIFICATIONS
const [notifications, setNotifications] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);
const [showNotifications, setShowNotifications] = useState(false);

const notificationRef = useRef(null);

const fetchNotifications = async () => {
  const token = localStorage.getItem("token");
  if (!token || user?.role === "admin") return;

  try {
    const response = await fetch("https://civiceye-ai-m1cw.onrender.com/api/notifications", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) return;

    const data = await response.json();

    if (response.ok && data.success) {
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
    }
  } catch (error) {
    console.error("Unable to fetch notifications:", error);
  }
};

useEffect(() => {
  if (!user || user.role === "admin") return;

  fetchNotifications();

  const timer = setInterval(fetchNotifications, 15000);

  return () => clearInterval(timer);
}, [user]);

const markNotificationRead = async (notificationId) => {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const response = await fetch(
      `https://civiceye-ai-m1cw.onrender.com/api/notifications/${notificationId}/read`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.ok) await fetchNotifications();
  } catch (error) {
    console.error("Unable to mark notification as read:", error);
  }
};

// CLOSE NOTIFICATION DROPDOWN WHEN CLICKING OUTSIDE
useEffect(() => {
  if (!showNotifications) return;

  const handleOutsideClick = (event) => {
    if (
      notificationRef.current &&
      !notificationRef.current.contains(event.target)
    ) {
      setShowNotifications(false);
    }
  };

  document.addEventListener("mousedown", handleOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
  };
}, [showNotifications]);


  // ADMIN DASHBOARD







  if (user?.role === "admin") {







    return <AdminDashboard />;







  }















  const [showTracking, setShowTracking] = useState(false);







  const [userIssues, setUserIssues] = useState([]);







  const [trackingLoading, setTrackingLoading] = useState(false);















  // AI STATES







  const [aiLoading, setAiLoading] = useState(false);







  const [aiResult, setAiResult] = useState(null);















  const [publicIssues, setPublicIssues] = useState([]);

  const [issueData, setIssueData] = useState({







    title: "",







    description: "",







    category: "Road Damage",







    location: "",







    image: "",
    latitude: null,
    longitude: null,

  });

  // PUBLIC MAP ISSUES
  // Only complaints with saved coordinates appear as map markers.
  useEffect(() => {
    const fetchPublicIssues = async () => {
      try {
        const response = await fetch("https://civiceye-ai-m1cw.onrender.com/api/issues");
        const data = await response.json();
        if (response.ok && data.success && Array.isArray(data.issues)) {
          setPublicIssues(data.issues);
        }
      } catch (error) {
        console.error("Unable to load map issues:", error);
      }
    };
    fetchPublicIssues();
  }, []);

  // CAMERA



  const [showCamera, setShowCamera] = useState(false);



  const [cameraStream, setCameraStream] = useState(null);



  const [capturedImage, setCapturedImage] = useState("");







  const videoRef = useRef(null);



  const canvasRef = useRef(null);

  const fileInputRef = useRef(null);







  useEffect(() => {



    if (videoRef.current && cameraStream) {



      videoRef.current.srcObject = cameraStream;



    }



  }, [cameraStream]);







  const openCamera = async () => {



    try {



      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {



        alert("Camera is not supported in this browser.");



        return;



      }







      const stream = await navigator.mediaDevices.getUserMedia({



        video: {



          facingMode: { ideal: "environment" },



        },



        audio: false,



      });







      setCameraStream(stream);



      setShowCamera(true);



    } catch (error) {



      console.error("Camera Error:", error);



      alert("Unable to access camera. Please allow camera permission.");



    }



  };







  const closeCamera = () => {



    if (cameraStream) {



      cameraStream.getTracks().forEach((track) => track.stop());



    }







    setCameraStream(null);



    setShowCamera(false);



  };







  const capturePhoto = () => {



    const video = videoRef.current;



    const canvas = canvasRef.current;







    if (!video || !canvas) return;







    canvas.width = video.videoWidth;



    canvas.height = video.videoHeight;







    const context = canvas.getContext("2d");



    context.drawImage(video, 0, 0, canvas.width, canvas.height);







    const image = canvas.toDataURL("image/jpeg", 0.8);







    setCapturedImage(image);



    setIssueData((prev) => ({



      ...prev,



      image,



    }));







    closeCamera();



  };







  const retakePhoto = () => {



    setCapturedImage("");



    setIssueData((prev) => ({



      ...prev,



      image: "",



    }));



    openCamera();



  };







  const removePhoto = () => {



    setCapturedImage("");



    setIssueData((prev) => ({



      ...prev,



      image: "",



    }));



  };



  // UPLOAD PHOTO FROM DEVICE



  const handleFileUpload = (e) => {

    const file = e.target.files?.[0];



    if (!file) return;



    if (!file.type.startsWith("image/")) {

      alert("Please select an image file.");

      e.target.value = "";

      return;

    }



    const reader = new FileReader();



    reader.onload = () => {

      const image = reader.result;



      setCapturedImage(image);



      setIssueData((prev) => ({

        ...prev,

        image,

      }));

    };



    reader.onerror = () => {

      alert("Unable to read the selected photo.");

    };



    reader.readAsDataURL(file);

  };



  const openFilePicker = () => {

    fileInputRef.current?.click();

  };

















  // SIGNUP







  const handleSignup = async (e) => {







    e.preventDefault();















    const name = e.target.name.value;







    const email = e.target.email.value;







    const password = e.target.password.value;















    try {







      const response = await fetch(







        "https://civiceye-ai-m1cw.onrender.com/api/auth/signup",







        {







          method: "POST",







          headers: {







            "Content-Type": "application/json",







          },







          body: JSON.stringify({







            name,







            email,







            password,







          }),







        }







      );















      const data = await response.json();















      if (!response.ok) {







        alert(data.message);







        return;







      }















      alert("Account created successfully! 🎉");















      setShowSignup(false);







      setShowLogin(true);







    } catch (error) {







      console.error(error);







      alert("Unable to connect to server!");







    }







  };















  // LOGIN







  const handleLogin = async (e) => {







    e.preventDefault();















    const email = e.target.email.value;







    const password = e.target.password.value;















    try {







      const response = await fetch(







        "https://civiceye-ai-m1cw.onrender.com/api/auth/login",







        {







          method: "POST",







          headers: {







            "Content-Type": "application/json",







          },







          body: JSON.stringify({







            email,







            password,







          }),







        }







      );















      const data = await response.json();















      if (!response.ok) {







        alert(data.message);







        return;







      }















      if (!data.token) {
        alert("Login token missing. Please check server authentication.");
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);















      alert("Login successful! 🎉");















      setShowLogin(false);







    } catch (error) {







      console.error(error);







      alert("Unable to connect to server!");







    }







  };















  // LOGOUT







  const handleLogout = () => {







    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);







    alert("Logged out successfully!");







  };















  // AI ISSUE ANALYSIS







  const handleAIAnalyze = async () => {







    if (!issueData.title || !issueData.description) {







      alert("Please enter issue title and description first.");







      return;







    }















    try {







      setAiLoading(true);







      setAiResult(null);















      const response = await fetch(







        "https://civiceye-ai-m1cw.onrender.com/api/ai/analyze",







        {







          method: "POST",







          headers: {







            "Content-Type": "application/json",







          },







          body: JSON.stringify({







            title: issueData.title,







            description: issueData.description,







          }),







        }







      );















      const data = await response.json();















      if (!response.ok) {







        alert(data.message || "AI analysis failed");







        return;







      }















      // AI CATEGORY







      if (data.category) {







        setIssueData((prev) => ({







          ...prev,







          category: data.category,







        }));







      }















      setAiResult({







        category: data.category,







        analysis:







          data.analysis ||







          data.message ||







          "AI analysis completed successfully.",







      });







    } catch (error) {







      console.error(error);







      alert("Unable to connect to AI service!");







    } finally {







      setAiLoading(false);







    }







  };















  // REPORT ISSUE







  const handleReportIssue = async (e) => {

    e.preventDefault();



    if (!user) {

      setShowReport(false);

      setShowLogin(true);

      return;

    }



    if (
      issueData.latitude === null ||
      issueData.latitude === undefined ||
      issueData.longitude === null ||
      issueData.longitude === undefined
    ) {
      alert("Please open the full map and mark the exact complaint location before submitting.");
      return;
    }

    if (submitLockRef.current) return;

submitLockRef.current = true;
setIsSubmitting(true);

    try {

      // Submit the complaint directly. Backend AI analysis is optional and

      // must not block the complaint if the AI service is unavailable.

      const response = await fetch("https://civiceye-ai-m1cw.onrender.com/api/issues", {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          title: issueData.title,

          description: issueData.description,

          category: issueData.category,

          location: issueData.location,

          image: issueData.image,
          latitude: issueData.latitude,
          longitude: issueData.longitude,

        }),

      });



      const data = await response.json();



      if (!response.ok) {

        alert(data.message || "Unable to submit the complaint.");

        return;

      }



      alert(

        "🚨 Issue reported successfully!\n\nYour complaint has been registered."

      );



      setIssueData({

        title: "",

        description: "",

        category: "Road Damage",

        location: "",

        image: "",
        latitude: null,
        longitude: null,

      });



      setCapturedImage("");

      setShowReport(false);

    } catch (error) {

      console.error("Issue Submission Error:", error);

      alert(

        "Unable to connect to the backend. Check that the server is running on https://civiceye-ai-m1cw.onrender.com."

      );

    }

  };



  // TRACK COMPLAINTS







  const handleTrackComplaints = async () => {







    // Open complaint tracking immediately when the button is clicked.
    setShowReport(false);

    if (!user) {







      setShowLogin(true);







      return;







    }















    // Show the tracking modal first; complaints will load inside it.
    setShowTracking(true);

    try {







      setTrackingLoading(true);















      const response = await fetch(
        "https://civiceye-ai-m1cw.onrender.com/api/issues/user",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        }
      );















      const data = await response.json();















      if (!response.ok) {







        alert(data.message || "Unable to fetch complaints");







        return;







      }















      setUserIssues(data.issues);







    } catch (error) {







      console.error(error);







      alert("Unable to connect to server!");







    } finally {







      setTrackingLoading(false);







    }







  };















  return (







    <div className="app">















      {/* NAVBAR */}















      <nav className="navbar">







        <div className="logo">







          <span className="logo-icon">👁</span>







          Civic<span>Eye</span>







          <small>AI</small>







        </div>















        <div className="nav-links">







          <a href="#home">Home</a>







          <a href="#features">Features</a>







          <a href="#about">About</a>



         
         
           <button
    className="assistant-nav-btn"
    onClick={() => setShowAssistantPage(true)}
  >
    🤖 AI Assistant
  </button>





        </div>















        <div className="nav-buttons">
          {user && user.role !== "admin" && (
            // <div style={{ position: "relative", display: "inline-block" }}>
            <div
  ref={notificationRef}
  style={{ position: "relative", display: "inline-block" }}
>
              <button
                type="button"
                className="login-btn"
                aria-label={`Notifications, ${unreadCount} unread`}
                onClick={() => {
                  setShowNotifications((open) => !open);
                  fetchNotifications();
                }}
              >
                🔔{unreadCount > 0 ? ` ${unreadCount}` : ""}
              </button>
              {showNotifications && (
                <div style={{ position: "absolute", right: "100px", top: "110%", width: "min(850px, 85vw)", maxHeight: "500px", overflowY: "auto", zIndex: 1000, background: "var(--card-bg, #fff)", color: "var(--text-color, #111)", border: "1px solid #ddd", borderRadius: "12px", padding: "12px", boxShadow: "0 8px 24px rgba(0,0,0,.18)" }}>
                  <strong>Notifications</strong>
                  {notifications.length === 0 ? (
                    <p style={{ marginBottom: 0 }}>No notifications yet.</p>
                  ) : notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification._id}
                      onClick={() => markNotificationRead(notification._id)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 6px", marginTop: "6px", border: 0, borderRadius: "8px", background: notification.isRead ? "transparent" : "#eaf2ff", color: "inherit", cursor: "pointer" }}
                    >
                      <strong>{notification.title}</strong>
                      <div>{notification.message}</div>
                      <small>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ""}{notification.isRead ? " · Read" : " · Click to mark read"}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}







          {user ? (







            <>







              <span className="welcome">







                Hi, {user.name}







              </span>















              <button







                className="login-btn"







                onClick={handleLogout}







              >







                Logout







              </button>







            </>







          ) : (







            <>







              <button







                className="login-btn"







                onClick={() => setShowLogin(true)}







              >







                Login







              </button>















              <button







                className="signup-btn"







                onClick={() => setShowSignup(true)}







              >







                Sign Up







              </button>







            </>







          )}







        </div>







      </nav>















      {/* HERO */}















      <section className="hero-section" id="home">







        <div className="hero-content">















          <div className="badge">







            🤖 AI POWERED CIVIC PLATFORM







          </div>















          <h1>







            Make Your City







            <span> Better With AI.</span>







          </h1>















          <p>







            Report civic issues, track complaints and help build







            a cleaner, safer and smarter community.







          </p>















          <div className="hero-buttons">















            <button







              className="primary-btn"







              onClick={() => {







                if (user) {







                  setShowTracking(false);
                  setShowReport(true);







                } else {







                  setShowLogin(true);







                }







              }}







            >







              Report an Issue →







            </button>















            <button







              className="secondary-btn"







              onClick={handleTrackComplaints}







            >







              Track Your Complaint







            </button>















          </div>















          <div className="stats">















            <div>







              <strong>24/7</strong>







              <span>Reporting</span>







            </div>















            <div>







              <strong>AI</strong>







              <span>Powered</span>







            </div>















            <div>







              <strong>100%</strong>







              <span>Transparent</span>







            </div>















          </div>















        </div>















        {/* HERO CARD */}















        <div className="hero-card">















          <div className="card-top">







            <span>Live Civic Issues</span>







            <span className="live">● LIVE</span>







          </div>















          <div className="issue-card">







            <div className="issue-icon">🕳️</div>















            <div>







              <h3>Road Damage</h3>







              <p>Main Road, Bhopal</p>







            </div>















            <span className="status pending">







              Pending







            </span>







          </div>















          <div className="issue-card">







            <div className="issue-icon">💡</div>















            <div>







              <h3>Street Light</h3>







              <p>MP Nagar, Bhopal</p>







            </div>















            <span className="status progress">







              In Progress







            </span>







          </div>















          <div className="issue-card">







            <div className="issue-icon">🗑️</div>















            <div>







              <h3>Garbage Collection</h3>







              <p>Arera Colony, Bhopal</p>







            </div>















            <span className="status resolved">







              Resolved







            </span>







          </div>















          <div className="ai-box">







            <span>✨</span>















            <div>







              <strong>AI Issue Detection</strong>















              <p>







                Automatically categorizes reported problems







              </p>







            </div>







          </div>















        </div>















      </section>

      {/* PUBLIC CIVIC ISSUES MAP */}
      <section className="public-issues-map-section" id="issue-map">
        <div className="section-heading">
          <span>LIVE CIVIC MAP</span>
          <h2>Reported issues around the city</h2>
          <p>Explore complaints that include a precise map location.</p>
        </div>
        <div className="public-issues-map-container">
          <IssueMap issues={publicIssues} height="420px" />
        </div>
        <p className="public-issues-map-note">Map markers appear for complaints submitted with a selected pin.</p>
      </section>

      {/* FEATURES */}















      <section className="features" id="features">















        <div className="section-heading">















          <span>WHY CIVICEYE?</span>















          <h2>







            Smart solutions for real problems.







          </h2>















          <p>







            One platform to report, analyze and resolve civic issues.







          </p>















        </div>















        <div className="feature-grid">















          <div className="feature">







            <div className="feature-icon">📸</div>















            <h3>Easy Reporting</h3>















            <p>







              Upload a photo and describe the civic issue in seconds.







            </p>







          </div>















          <div className="feature">







            <div className="feature-icon">🤖</div>















            <h3>AI Analysis</h3>















            <p>







              AI automatically identifies and categorizes the issue.







            </p>







          </div>















          <div className="feature">







            <div className="feature-icon">📍</div>















            <h3>Location Tracking</h3>















            <p>







              Pin the exact location so authorities can respond faster.







            </p>







          </div>















          <div className="feature">







            <div className="feature-icon">📊</div>















            <h3>Track Progress</h3>















            <p>







              Follow your complaint from submission to resolution.







            </p>







          </div>















        </div>















      </section>















      {/* ABOUT */}















      <section className="about" id="about">















        <div>















          <span className="about-label">







            CIVICEYE AI







          </span>















          <h2>







            Technology for a better tomorrow.







          </h2>















        </div>















        <p>







          CivicEye AI connects citizens and authorities through







          intelligent technology, making civic problem reporting







          faster, easier and more transparent.







        </p>















      </section>















      {/* FOOTER */}















      <footer>















        <div className="logo">







          <span className="logo-icon">👁</span>







          Civic<span>Eye</span>







          <small>AI</small>







        </div>















        <p>







          Building smarter communities with AI.







        </p>















      </footer>















      {/* LOGIN MODAL */}















      {showLogin && (







        <div







          className="modal-overlay"







          onClick={() => setShowLogin(false)}







        >















          <div







            className="modal"







            onClick={(e) => e.stopPropagation()}







          >















            <button







              className="close"







              onClick={() => setShowLogin(false)}







            >







              ×







            </button>















            <div className="modal-icon">







              👁







            </div>















            <h2>







              Welcome Back







            </h2>















            <p>







              Login to your CivicEye account







            </p>















            <form onSubmit={handleLogin}>















              <input







                type="email"







                name="email"







                placeholder="Email address"







                required







              />















              <input







                type="password"







                name="password"







                placeholder="Password"







                required







              />















              <button







                type="submit"







                className="modal-btn"







              >







                Login







              </button>















            </form>















            <div className="switch">















              Don't have an account?















              <button







                onClick={() => {







                  setShowLogin(false);







                  setShowSignup(true);







                }}







              >







                Sign Up







              </button>















            </div>















          </div>















        </div>







      )}















      {/* SIGNUP MODAL */}















      {showSignup && (







        <div







          className="modal-overlay"







          onClick={() => setShowSignup(false)}







        >















          <div







            className="modal"







            onClick={(e) => e.stopPropagation()}







          >















            <button







              className="close"







              onClick={() => setShowSignup(false)}







            >







              ×







            </button>















            <div className="modal-icon">







              🚀







            </div>















            <h2>







              Create Account







            </h2>















            <p>







              Join CivicEye and improve your city







            </p>















            <form onSubmit={handleSignup}>















              <input







                type="text"







                name="name"







                placeholder="Full name"







                required







              />















              <input







                type="email"







                name="email"







                placeholder="Email address"







                required







              />















              <input







                type="password"







                name="password"







                placeholder="Password"







                required







              />















              <button







                type="submit"







                className="modal-btn"







              >







                Create Account







              </button>















            </form>















            <div className="switch">















              Already have an account?















              <button







                onClick={() => {







                  setShowSignup(false);







                  setShowLogin(true);







                }}







              >







                Login







              </button>















            </div>















          </div>















        </div>







      )}















      {/* REPORT ISSUE MODAL */}















      {showReport && (







        <div







          className="modal-overlay"







          onClick={() => setShowReport(false)}







        >















          <div







            className="modal report-modal"







            onClick={(e) => e.stopPropagation()}







          >















            <button







              className="close"







              onClick={() => setShowReport(false)}







            >







              ×







            </button>















            <div className="modal-icon">







              🚨







            </div>















            <h2>







              Report an Issue







            </h2>















            <p>







              Help make your city better.







            </p>















            <form onSubmit={handleReportIssue}>















              {/* TITLE */}















              <input







                type="text"







                placeholder="Issue title"







                value={issueData.title}







                onChange={(e) =>







                  setIssueData({







                    ...issueData,







                    title: e.target.value,







                  })







                }







                required







              />















              {/* DESCRIPTION */}















              <textarea







                placeholder="Describe the issue"







                value={issueData.description}







                onChange={(e) =>







                  setIssueData({







                    ...issueData,







                    description: e.target.value,







                  })







                }







                required







              />















              {/* AI BUTTON */}















              <button







                type="button"







                className="ai-analyze-btn"







                onClick={handleAIAnalyze}







                disabled={aiLoading}







              >







                {aiLoading







                  ? "✨ AI Analyzing..."







                  : "✨ Analyze Issue with AI"}







              </button>















              {/* AI RESULT */}















              {aiResult && (







                <div className="ai-result">















                  <div className="ai-result-title">







                    🤖 AI Analysis







                  </div>















                  <div className="ai-category">







                    <strong>Detected Category:</strong>{" "}







                    {aiResult.category}







                  </div>















                  <p>







                    {aiResult.analysis}







                  </p>















                </div>







              )}















              {/* CATEGORY */}















              <select







                value={issueData.category}







                onChange={(e) =>







                  setIssueData({







                    ...issueData,







                    category: e.target.value,







                  })







                }







              >















                <option value="Road Damage">







                  Road Damage







                </option>















                <option value="Street Light">







                  Street Light







                </option>















                <option value="Garbage">







                  Garbage







                </option>















                <option value="Water Supply">







                  Water Supply







                </option>















                <option value="Drainage">







                  Drainage







                </option>















                <option value="Other">







                  Other







                </option>















              </select>















              {/* LOCATION */}















              <input







                type="text"







                placeholder="Location"







                value={issueData.location}







                onChange={(e) =>







                  setIssueData({







                    ...issueData,







                    location: e.target.value,







                  })







                }







                required







              />

              <div className="issue-location-picker">
                <label className="issue-location-label">Pin the exact location</label>
                <p className="issue-location-help">
                  Open the large map to pinpoint the civic issue accurately.
                </p>
                <button
                  type="button"
                  className="modal-btn"
                  onClick={() => setShowLocationPicker(true)}
                >
                  📍 {issueData.latitude != null && issueData.longitude != null
                    ? "Change Location on Full Map"
                    : "Open Full Map to Mark Location"}
                </button>
                {issueData.latitude != null && issueData.longitude != null && (
                  <p className="issue-location-coordinates">
                    Selected: {Number(issueData.latitude).toFixed(6)}, {Number(issueData.longitude).toFixed(6)}
                  </p>
                )}
              </div>{/* CAMERA / PHOTO */}



              <div

                style={{

                  display: "flex",

                  gap: "10px",

                  flexDirection: "column",

                }}

              >

                <button

                  type="button"

                  className="modal-btn"

                  onClick={openCamera}

                >

                  📷 {capturedImage ? "Retake Photo" : "Open Camera"}

                </button>



                <button

                  type="button"

                  className="modal-btn"

                  onClick={openFilePicker}

                >

                  🖼️ Choose from Device

                </button>



                <input

                  ref={fileInputRef}

                  type="file"

                  accept="image/*"

                  onChange={handleFileUpload}

                  style={{ display: "none" }}

                />

              </div>



              {capturedImage && (

                <div style={{ marginTop: "15px", textAlign: "center" }}>

                  <img

                    src={capturedImage}

                    alt="Selected civic issue"

                    style={{

                      width: "100%",

                      maxHeight: "250px",

                      objectFit: "cover",

                      borderRadius: "12px",

                    }}

                  />



                  <button

                    type="button"

                    className="modal-btn"

                    onClick={removePhoto}

                    style={{ marginTop: "10px" }}

                  >

                    ❌ Remove Photo

                  </button>

                </div>

              )}



              {/* SUBMIT */}















              <button







                type="submit"







                className="modal-btn"







              >







                Submit Issue







              </button>















            </form>















          </div>















        </div>







      )}















      {/* FULL-SCREEN LOCATION PICKER */}
      {showLocationPicker && (
        <div
          className="location-picker-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Select complaint location"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "#0b1220",
            display: "flex",
            flexDirection: "column",
            padding: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              color: "#fff",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Mark Complaint Location</h2>
              <p style={{ margin: "6px 0 0", opacity: 0.8 }}>
                Click or tap the exact spot on the map. Then press Use This Location.
              </p>
            </div>
            <button
              type="button"
              className="modal-btn"
              onClick={() => setShowLocationPicker(false)}
            >
              ← Back to Report
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, borderRadius: "14px", overflow: "hidden" }}>
            <IssueMap
              selectable
              showSearch
              selectedLocation={
                issueData.latitude != null && issueData.longitude != null
                  ? { latitude: issueData.latitude, longitude: issueData.longitude }
                  : null
              }
              onLocationSelect={({ latitude, longitude }) =>
                setIssueData((prev) => ({ ...prev, latitude, longitude }))
              }
              height="100%"
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              color: "#fff",
              paddingTop: "12px",
            }}
          >
            <span>
              {issueData.latitude != null && issueData.longitude != null
                ? `Selected: ${Number(issueData.latitude).toFixed(6)}, ${Number(issueData.longitude).toFixed(6)}`
                : "No location selected yet"}
            </span>
            <button
              type="button"
              className="modal-btn"
              disabled={issueData.latitude == null || issueData.longitude == null}
              onClick={() => setShowLocationPicker(false)}
            >
              ✓ Use This Location
            </button>
          </div>
        </div>
      )}

      {/* CAMERA MODAL */}







      {showCamera && (



        <div



          className="modal-overlay"



          onClick={closeCamera}



        >



          <div



            className="modal"



            onClick={(e) => e.stopPropagation()}



            style={{ maxWidth: "600px" }}



          >



            <button



              className="close"



              onClick={closeCamera}



            >



              ×



            </button>







            <div className="modal-icon">📷</div>







            <h2>Take Photo</h2>







            <p>Capture a photo of the civic issue.</p>







            <video



              ref={videoRef}



              autoPlay



              playsInline



              muted



              style={{



                width: "100%",



                maxHeight: "400px",



                borderRadius: "12px",



                objectFit: "cover",



                background: "#000",



              }}



            />







            <canvas



              ref={canvasRef}



              style={{ display: "none" }}



            />







            <button



              type="button"



              className="modal-btn"



              onClick={capturePhoto}



              style={{ marginTop: "15px" }}



            >



              📸 Capture Photo



            </button>



          </div>



        </div>



      )}







      {/* TRACK COMPLAINT MODAL */}















      {showTracking && (







        <div







          className="modal-overlay"







          onClick={() => setShowTracking(false)}







        >















          <div







            className="modal tracking-modal"







            onClick={(e) => e.stopPropagation()}







          >















            <button







              className="close"







              onClick={() => setShowTracking(false)}







            >







              ×







            </button>















            <div className="modal-icon">







              📊







            </div>















            <h2>







              My Complaints







            </h2>















            <p>







              Track the status of your reported issues.







            </p>















            {trackingLoading ? (







              <p>







                Loading complaints...







              </p>







            ) : userIssues.length === 0 ? (















              <div className="no-issues">















                <div>📭</div>















                <h3>







                  No complaints yet







                </h3>















                <p>







                  You haven't reported any civic issues yet.







                </p>















              </div>















            ) : (















              <div className="complaints-list">















                {userIssues.map((issue) => (



















                  <div







                    className="complaint-item"







                    key={issue._id}







                  >



















                    <div className="complaint-header">















                      <h3>







                        {issue.title}







                      </h3>















                      <span







                        className={`status ${







                          issue.status === "Resolved"







                            ? "resolved"







                            : issue.status === "In Progress"







                            ? "progress"







                            : "pending"







                        }`}







                      >







                        {issue.status}







                      </span>















                    </div>















                    <p>







                      <strong>Category:</strong>{" "}







                      {issue.category}







                    </p>















                    <p>







                      <strong>Location:</strong>{" "}







                      {issue.location}







                    </p>















                    <p>







                      <strong>Description:</strong>{" "}







                      {issue.description}







                    </p>















                    <small>







                      Reported on:{" "}







                      {new Date(







                        issue.createdAt







                      ).toLocaleDateString()}







                    </small>





<div className="complaint-timeline">
  <h4>Complaint Progress</h4>
  {(() => {
    const workflow = ["Pending", "In Progress", "Resolved"];
    const currentIndex = Math.max(0, workflow.indexOf(issue.status || "Pending"));
    const history = Array.isArray(issue.statusHistory) ? issue.statusHistory : [];

    // Show only stages up to the complaint's CURRENT status.
    // Ignore stale later-stage records if an admin moved the status backwards.
    const reachedStatuses = workflow.slice(0, currentIndex + 1);

    return reachedStatuses.map((status) => {
      const matchingEntries = history.filter((entry) => entry.status === status);
      const latestEntry = matchingEntries.length
        ? matchingEntries[matchingEntries.length - 1]
        : null;

      // Pending means the complaint was submitted; use its real creation date.
      const changedAt = status === "Pending"
        ? issue.createdAt
        : latestEntry?.changedAt;
      const note = status === "Pending"
        ? "Complaint submitted"
        : latestEntry?.note || `Status changed to ${status}`;

      return (
        <div className="timeline-entry" key={status}>
          <span
            className={`timeline-dot ${
              status === "Resolved"
                ? "resolved"
                : status === "In Progress"
                ? "progress"
                : "pending"
            }`}
          />
          <div className="timeline-content">
            <strong>{status}</strong>
            <p>{note}</p>
            <small>
              {changedAt
                ? new Date(changedAt).toLocaleString()
                : "Date unavailable"}
            </small>
          </div>
        </div>
      );
    });
  })()}
</div></div>















                ))}















              </div>















            )}















          </div>















        </div>







      )}




      {/* CIVICEYE AI ASSISTANT */}
      <AssistantChat
        user={user}
        isPage={showAssistantPage}
        onOpenPage={() => setShowAssistantPage(true)}
        onClosePage={() => setShowAssistantPage(false)}
      />











    </div>







  );







}















export default App;