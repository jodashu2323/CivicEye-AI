
import { useEffect, useState } from "react";
import IssueMap from "./IssueMap";
import "./AdminPremium.css";
import LiveNotifications from "./LiveNotifications";

function AdminDashboard() {
  const [issues, setIssues] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("complaints");
  const [showFullMap, setShowFullMap] = useState(false);
  const [selectedMapIssue, setSelectedMapIssue] = useState(null);
  const [pickedLocation, setPickedLocation] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [notificationSelectedIssueId, setNotificationSelectedIssueId] =
    useState(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  // =========================
  // FETCH ISSUES
  // =========================

  const fetchIssues = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "http://localhost:5000/api/admin/issues",
        { headers: getAuthHeaders() }
      );

      const data = await response.json();

      if (data.success) {
        setIssues(data.issues);
      } else {
        alert(data.message || "Unable to fetch complaints");
      }
    } catch (error) {
      console.error("Error fetching issues:", error);
      alert("Unable to connect to server!");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // FETCH USERS
  // =========================

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/admin/users",
        { headers: getAuthHeaders() }
      );

      const data = await response.json();

      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchIssues();
    fetchUsers();
  }, []);

  // =========================
  // UPDATE STATUS
  // =========================

  const updateStatus = async (issueId, status) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/admin/issues/${issueId}/status`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setIssues((prevIssues) =>
          prevIssues.map((issue) =>
            issue._id === issueId
              ? {
                  ...issue,
                  status: data.issue.status,
                }
              : issue
          )
        );

        setSelectedMapIssue((previous) =>
          previous && previous._id === issueId
            ? {
                ...previous,
                status: data.issue.status,
              }
            : previous
        );
      } else {
        alert(data.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Server error");
    }
  };

  // =========================
  // SAVE / UPDATE COMPLAINT LOCATION
  // =========================

  const saveComplaintLocation = async () => {
    if (!selectedMapIssue || !pickedLocation) {
      alert("Pehle map par complaint ki location select karo.");
      return;
    }

    try {
      setSavingLocation(true);

      const response = await fetch(
        `http://localhost:5000/api/admin/issues/${selectedMapIssue._id}/location`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latitude: pickedLocation.latitude,
            longitude: pickedLocation.longitude,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.message || "Complaint location save nahi ho paayi.");
        return;
      }

      setIssues((previous) =>
        previous.map((issue) =>
          issue._id === data.issue._id
            ? { ...issue, ...data.issue }
            : issue
        )
      );

      setSelectedMapIssue(data.issue);
      setPickedLocation(null);

      alert("Complaint location successfully save ho gayi!");
    } catch (error) {
      console.error("Error saving complaint location:", error);
      alert("Server se connect nahi ho paaya. Backend check karo.");
    } finally {
      setSavingLocation(false);
    }
  };

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  // =========================
  // STATS
  // =========================

  const totalIssues = issues.length;

  const pendingIssues = issues.filter(
    (issue) => issue.status === "Pending"
  ).length;

  const progressIssues = issues.filter(
    (issue) => issue.status === "In Progress"
  ).length;

  const resolvedIssues = issues.filter(
    (issue) => issue.status === "Resolved"
  ).length;

  // =========================
  // ANALYTICS
  // =========================

  const resolutionRate = totalIssues
    ? Math.round((resolvedIssues / totalIssues) * 100)
    : 0;

  const categoryStats = Object.entries(
    issues.reduce((counts, issue) => {
      const category = issue.category || "Other";
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const monthlyStats = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));

    const year = date.getFullYear();
    const month = date.getMonth();

    const count = issues.filter((issue) => {
      if (!issue.createdAt) return false;

      const created = new Date(issue.createdAt);

      return (
        created.getFullYear() === year &&
        created.getMonth() === month
      );
    }).length;

    return {
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      count,
    };
  });

  const maxMonthlyCount = Math.max(
    1,
    ...monthlyStats.map((item) => item.count)
  );

  const maxCategoryCount = Math.max(
    1,
    ...categoryStats.map((item) => item[1])
  );

  // =========================
  // CATEGORY ICON
  // =========================

  const getIssueIcon = (category) => {
    switch (category) {
      case "Road Damage":
        return "🕳️";
      case "Street Light":
        return "💡";
      case "Garbage":
        return "🗑️";
      case "Water Supply":
        return "💧";
      case "Drainage":
        return "🌊";
      default:
        return "⚠️";
    }
  };

  // =========================
  // OPEN COMPLAINT ON MAP
  // =========================

  const openComplaintOnMap = (issue, fromNotification = false) => {
    setSelectedMapIssue(issue);

    setNotificationSelectedIssueId(
      fromNotification ? String(issue._id) : null
    );

    setPickedLocation(
      issue.latitude != null && issue.longitude != null
        ? {
            latitude: Number(issue.latitude),
            longitude: Number(issue.longitude),
          }
        : null
    );

    setShowFullMap(true);
  };

  // =========================
  // OPEN COMPLAINT FROM NOTIFICATION
  // =========================

  const handleNotificationClick = (notification) => {
    const issueId =
      typeof notification.issue === "object"
        ? notification.issue?._id
        : notification.issue;

    if (!issueId) {
      alert("Complaint details are not available.");
      return;
    }

    const selectedIssue = issues.find(
      (issue) => String(issue._id) === String(issueId)
    );

    if (!selectedIssue) {
      alert("Complaint not found. Please refresh the dashboard.");
      return;
    }

    setActiveTab("complaints");
    openComplaintOnMap(selectedIssue, true);
  };

  // =========================
  // CLOSE FULL MAP
  // =========================

  const closeFullMap = () => {
    setShowFullMap(false);
    setSelectedMapIssue(null);
    setPickedLocation(null);
    setNotificationSelectedIssueId(null);
  };

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <div>
            <div style={{ fontSize: "35px", marginBottom: "12px" }}>
              👁️
            </div>
            <div>Loading Admin Dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* NAVBAR */}

      <nav className="admin-navbar">
        <div className="logo">
          <span className="logo-icon">👁</span>
          Civic<span>Eye</span>
          <small>AI</small>
        </div>

        <div className="admin-title">
          Administrator
        </div>

        <LiveNotifications
          onNotificationClick={handleNotificationClick}
        />

        <div className="admin-profile">
          <div className="admin-avatar">
            A
          </div>

          <div className="admin-user-info">
            <strong>System Admin</strong>
            <span>Administrator</span>
          </div>

          <button
            className="admin-logout-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* MAIN DASHBOARD */}

      <main className="admin-container">
        {/* HEADER */}

        <div className="admin-heading">
          <div>
            <span className="about-label">
              CIVICEYE AI
            </span>

            <h1>
              Admin Dashboard
            </h1>

            <p>
              Monitor and manage all civic complaints
              reported by citizens.
            </p>
          </div>

          <button
            className="refresh-btn"
            onClick={() => {
              fetchIssues();
              fetchUsers();
            }}
          >
            ↻ Refresh Dashboard
          </button>
        </div>

        {/* STATISTICS */}

        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="stat-icon">📋</div>
            <div>
              <strong>{totalIssues}</strong>
              <p>Total Issues</p>
            </div>
          </div>

          <div className="admin-stat-card pending-stat">
            <div className="stat-icon">🟡</div>
            <div>
              <strong>{pendingIssues}</strong>
              <p>Pending</p>
            </div>
          </div>

          <div className="admin-stat-card progress-stat">
            <div className="stat-icon">🔵</div>
            <div>
              <strong>{progressIssues}</strong>
              <p>In Progress</p>
            </div>
          </div>

          <div className="admin-stat-card resolved-stat">
            <div className="stat-icon">🟢</div>
            <div>
              <strong>{resolvedIssues}</strong>
              <p>Resolved</p>
            </div>
          </div>
        </div>

        {/* TABS */}

        <div className="admin-tabs">
          <button
            className={
              activeTab === "complaints"
                ? "admin-tab active"
                : "admin-tab"
            }
            onClick={() => setActiveTab("complaints")}
          >
            📋 Complaints
          </button>

          <button
            className={
              activeTab === "users"
                ? "admin-tab active"
                : "admin-tab"
            }
            onClick={() => setActiveTab("users")}
          >
            👥 Users
          </button>

          <button
            className={
              activeTab === "analytics"
                ? "admin-tab active"
                : "admin-tab"
            }
            onClick={() => setActiveTab("analytics")}
          >
            📊 Analytics
          </button>
        </div>

        {/* ANALYTICS */}

        {activeTab === "analytics" && (
          <section className="admin-issues">
            <div className="admin-section-header">
              <div>
                <h2>📊 Complaint Analytics</h2>
                <p>
                  Insights calculated from the complaints currently
                  loaded from your database.
                </p>
              </div>

              <button
                className="refresh-btn"
                onClick={() => {
                  fetchIssues();
                  fetchUsers();
                }}
              >
                ↻ Refresh Analytics
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: "16px",
                margin: "20px 0 28px",
              }}
            >
              <div className="admin-stat-card">
                <div className="stat-icon">📋</div>
                <div>
                  <strong>{totalIssues}</strong>
                  <p>Total Complaints</p>
                </div>
              </div>

              <div className="admin-stat-card pending-stat">
                <div className="stat-icon">⏳</div>
                <div>
                  <strong>{pendingIssues}</strong>
                  <p>Pending</p>
                </div>
              </div>

              <div className="admin-stat-card progress-stat">
                <div className="stat-icon">🔄</div>
                <div>
                  <strong>{progressIssues}</strong>
                  <p>In Progress</p>
                </div>
              </div>

              <div className="admin-stat-card resolved-stat">
                <div className="stat-icon">✅</div>
                <div>
                  <strong>{resolvedIssues}</strong>
                  <p>Resolved</p>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "20px",
              }}
            >
              <div
                style={{
                  background: "var(--card-bg, #fff)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "20px",
                  color: "var(--text-color, #0f172a)",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Resolution Rate</h3>

                <div
                  style={{
                    fontSize: "36px",
                    fontWeight: 800,
                    margin: "10px 0",
                  }}
                >
                  {resolutionRate}%
                </div>

                <div
                  style={{
                    height: "12px",
                    borderRadius: "99px",
                    background: "#e2e8f0",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${resolutionRate}%`,
                      height: "100%",
                      background: "#16a34a",
                      transition: "width .3s",
                    }}
                  />
                </div>

                <p style={{ color: "#64748b", fontSize: "13px" }}>
                  {resolvedIssues} of {totalIssues} complaints are
                  marked Resolved.
                </p>
              </div>

              <div
                style={{
                  background: "var(--card-bg, #fff)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "20px",
                  color: "var(--text-color, #0f172a)",
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  Complaints by Category
                </h3>

                {categoryStats.length === 0 ? (
                  <p>No complaint data available yet.</p>
                ) : (
                  categoryStats.map(([category, count]) => (
                    <div
                      key={category}
                      style={{ margin: "15px 0" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          fontSize: "14px",
                          marginBottom: "6px",
                        }}
                      >
                        <span>{category}</span>
                        <strong>{count}</strong>
                      </div>

                      <div
                        style={{
                          height: "9px",
                          background: "#e2e8f0",
                          borderRadius: "99px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${(count / maxCategoryCount) * 100}%`,
                            background: "#2563eb",
                            borderRadius: "99px",
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div
                style={{
                  background: "var(--card-bg, #fff)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "20px",
                  color: "var(--text-color, #0f172a)",
                  gridColumn: "1 / -1",
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  Monthly Complaints — Last 6 Months
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                    gap: "12px",
                    alignItems: "end",
                    minHeight: "190px",
                    paddingTop: "12px",
                  }}
                >
                  {monthlyStats.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "end",
                        gap: "8px",
                        minWidth: 0,
                      }}
                    >
                      <strong style={{ fontSize: "13px" }}>
                        {item.count}
                      </strong>

                      <div
                        title={`${item.label}: ${item.count} complaints`}
                        style={{
                          width: "min(100%, 48px)",
                          height: `${Math.max(
                            6,
                            (item.count / maxMonthlyCount) * 125
                          )}px`,
                          background: "#0d9488",
                          borderRadius: "8px 8px 2px 2px",
                        }}
                      />

                      <span
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                <p
                  style={{
                    color: "#64748b",
                    fontSize: "12px",
                    marginBottom: 0,
                  }}
                >
                  Monthly totals are based on each complaint's
                  createdAt timestamp.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* COMPLAINTS */}

        {activeTab === "complaints" && (
          <section className="admin-issues">
            <div className="admin-section-header">
              <div>
                <h2>All Complaints</h2>
                <p>
                  Manage complaints submitted by citizens.
                </p>
              </div>

              <button
                className="refresh-btn"
                onClick={fetchIssues}
              >
                ↻ Refresh
              </button>
            </div>

            {/* COMPLAINT LOCATIONS MAP */}

            <div style={{ marginBottom: "28px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "8px",
                }}
              >
                <h3 style={{ margin: 0 }}>
                  📍 Complaint Locations
                </h3>

                <button
                  type="button"
                  className="refresh-btn"
                  onClick={() => {
                    setSelectedMapIssue(null);
                    setPickedLocation(null);
                    setNotificationSelectedIssueId(null);
                    setShowFullMap(true);
                  }}
                >
                  ⛶ Open Full Map
                </button>
              </div>

              <p style={{ marginBottom: "16px" }}>
                View reported civic complaints on the map. Markers
                appear for complaints that have saved latitude and
                longitude coordinates.
              </p>

              <IssueMap
                issues={issues}
                selectable={false}
                showSearch={true}
                onStatusChange={updateStatus}
                height="420px"
              />
            </div>

            {issues.length === 0 ? (
              <div className="no-issues">
                <div>📭</div>
                <h3>No complaints found</h3>
                <p>
                  There are currently no reported civic issues.
                </p>
              </div>
            ) : (
              <div className="admin-issue-list">
                {issues.map((issue) => (
                  <div
                    className="admin-issue-card"
                    key={issue._id}
                  >
                    {/* ISSUE */}

                    <div className="issue-main">
                      <div className="admin-issue-icon">
                        {getIssueIcon(issue.category)}
                      </div>

                      <div className="admin-issue-info">
                        <h3>{issue.title}</h3>

                        <p className="issue-description">
                          {issue.description}
                        </p>

                        <div className="issue-details">
                          <span>📂 {issue.category}</span>
                          <span>📍 {issue.location}</span>
                          <span>
                            👤 {issue.userId?.name || "Unknown User"}
                          </span>
                        </div>

                        <small>
                          Reported on{" "}
                          {new Date(issue.createdAt).toLocaleDateString(
                            "en-IN"
                          )}
                        </small>
                      </div>
                    </div>

                    {/* ACTIONS */}

                    <div className="admin-issue-actions">
                      <span
                        className={`admin-status ${issue.status
                          .toLowerCase()
                          .replace(" ", "-")}`}
                      >
                        {issue.status}
                      </span>

                      <button
                        type="button"
                        className="refresh-btn"
                        style={{ marginBottom: "8px" }}
                        onClick={() => openComplaintOnMap(issue)}
                      >
                        📍 Locate on Full Map
                      </button>

                      <select
                        value={issue.status}
                        onChange={(event) =>
                          updateStatus(issue._id, event.target.value)
                        }
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* USERS */}

        {activeTab === "users" && (
          <section className="admin-issues">
            <div className="admin-section-header">
              <div>
                <h2>Registered Users</h2>
                <p>
                  View all citizens registered on CivicEye.
                </p>
              </div>

              <button
                className="refresh-btn"
                onClick={fetchUsers}
              >
                ↻ Refresh
              </button>
            </div>

            {users.length === 0 ? (
              <div className="no-issues">
                <div>👥</div>
                <h3>No users found</h3>
                <p>
                  No registered users are available.
                </p>
              </div>
            ) : (
              <div className="admin-users-list">
                {users.map((user) => (
                  <div
                    className="admin-user-card"
                    key={user._id}
                  >
                    <div className="user-avatar">
                      {user.name
                        ? user.name.charAt(0).toUpperCase()
                        : "U"}
                    </div>

                    <div className="user-info">
                      <h3>{user.name}</h3>
                      <p>{user.email}</p>
                    </div>

                    <span
                      className={
                        user.role === "admin"
                          ? "user-role admin-role"
                          : "user-role"
                      }
                    >
                      {user.role}
                    </span>

                    <small>
                      Joined{" "}
                      {new Date(user.createdAt).toLocaleDateString(
                        "en-IN"
                      )}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* FULL SCREEN MAP */}

      {showFullMap && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Full screen complaint map"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "#0b1120",
            display: "flex",
            flexDirection: "column",
            padding: "12px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              color: "#fff",
              padding: "4px 2px 12px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 4px",
                  fontSize: "20px",
                }}
              >
                📍{" "}
                {selectedMapIssue
                  ? "Complaint Location"
                  : "All Complaint Locations"}
              </h2>

              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  opacity: 0.8,
                }}
              >
                {selectedMapIssue
                  ? `${selectedMapIssue.title || "Civic complaint"} — ${
                      selectedMapIssue.location || "Location not provided"
                    }`
                  : "Zoom and pan to inspect available complaint markers."}

                {selectedMapIssue &&
                  " · Search an area or click on the map to select/correct this complaint location."}
              </p>

              {notificationSelectedIssueId && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    marginTop: "8px",
                    padding: "6px 10px",
                    borderRadius: "7px",
                    background: "#4c1d95",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <span>🟣</span>
                  OPENED FROM NOTIFICATION — HIGHLIGHTED ON MAP
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={closeFullMap}
              style={{
                border: "1px solid #64748b",
                background: "#1e293b",
                color: "#fff",
                borderRadius: "10px",
                padding: "10px 16px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ← Back to Dashboard
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <IssueMap
              issues={issues}
              selectable={Boolean(selectedMapIssue)}
              selectedIssueId={notificationSelectedIssueId}
              selectedLocation={
                pickedLocation ||
                (selectedMapIssue &&
                selectedMapIssue.latitude != null &&
                selectedMapIssue.longitude != null
                  ? {
                      latitude: Number(selectedMapIssue.latitude),
                      longitude: Number(selectedMapIssue.longitude),
                    }
                  : null)
              }
              onLocationSelect={setPickedLocation}
              onStatusChange={updateStatus}
              showSearch={true}
              height="100%"
            />
          </div>

          {selectedMapIssue && (
            <div
              style={{
                color: "#fff",
                padding: "10px 2px 2px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <span>
                {pickedLocation
                  ? `Selected coordinates: ${pickedLocation.latitude}, ${pickedLocation.longitude}`
                  : selectedMapIssue.latitude != null &&
                    selectedMapIssue.longitude != null
                  ? `Current coordinates: ${selectedMapIssue.latitude}, ${selectedMapIssue.longitude}`
                  : "Location missing — search or click the map to select the complaint location."}
                {" · "}Status: {selectedMapIssue.status || "Pending"}
              </span>

              <button
                type="button"
                disabled={!pickedLocation || savingLocation}
                onClick={saveComplaintLocation}
                style={{
                  border: "1px solid #0d9488",
                  background:
                    !pickedLocation || savingLocation
                      ? "#334155"
                      : "#0f766e",
                  color: "#fff",
                  borderRadius: "10px",
                  padding: "10px 16px",
                  cursor:
                    !pickedLocation || savingLocation
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 600,
                  opacity:
                    !pickedLocation || savingLocation ? 0.65 : 1,
                }}
              >
                {savingLocation
                  ? "Saving location..."
                  : "Save Complaint Location"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
