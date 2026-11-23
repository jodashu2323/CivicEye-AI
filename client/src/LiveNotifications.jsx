
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = "http://localhost:5000";

export default function LiveNotifications({
  showBell = true,
  onNewNotification,
  onNotificationClick,
}) {
  const token = localStorage.getItem("token");

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const audioContextRef = useRef(null);
  const soundUnlockedRef = useRef(false);
  const containerRef = useRef(null);

  // Unlock browser audio after the user's first bell interaction.
  const unlockAudio = async () => {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      soundUnlockedRef.current =
        audioContextRef.current.state === "running";
    } catch (error) {
      console.error("Audio unlock error:", error);
    }
  };

  // Play notification sound using the unlocked audio context.
  const playNotificationSound = () => {
    const audioContext = audioContextRef.current;

    if (!soundUnlockedRef.current || !audioContext) return;
    if (audioContext.state !== "running") return;

    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        880,
        audioContext.currentTime
      );

      gain.gain.setValueAtTime(0.15, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.35
      );

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.35);
    } catch (error) {
      console.error("Notification sound error:", error);
    }
  };

  // Fetch notifications saved in MongoDB.
  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Notification fetch error:", error);
    }
  }, [token]);

  // Listen for real-time notifications and complaint success sounds.
  useEffect(() => {
    if (!token) return;

    fetchNotifications();

    const socket = io(API_URL, {
      auth: { token },
      reconnection: true,
    });

    socket.on("new_notification", (notification) => {
      playNotificationSound();
      fetchNotifications();

      if (onNewNotification) {
        onNewNotification(notification);
      }
    });

    socket.on("connect_error", (error) => {
      console.error("Notification socket error:", error.message);
    });

    const handleLocalSound = () => {
      playNotificationSound();
    };

    window.addEventListener("civiceye:play-sound", handleLocalSound);

    return () => {
      socket.disconnect();
      window.removeEventListener(
        "civiceye:play-sound",
        handleLocalSound
      );
    };
  }, [token, fetchNotifications, onNewNotification]);

  // Unlock audio when the existing App.jsx bell is clicked.
  useEffect(() => {
    const handleUnlockAudio = () => {
      unlockAudio();
    };

    window.addEventListener(
      "civiceye:unlock-audio",
      handleUnlockAudio
    );

    return () => {
      window.removeEventListener(
        "civiceye:unlock-audio",
        handleUnlockAudio
      );
    };
  }, []);

  // Close notification panel when clicking outside.
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Mark one notification as read.
  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        await fetchNotifications();
      }
    } catch (error) {
      console.error("Mark notification read error:", error);
    }
  };

  // Mark all notifications as read.
  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchNotifications();
      }
    } catch (error) {
      console.error("Mark all notifications read error:", error);
    }
  };

  // Open the complaint selected from a notification.
  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    setIsOpen(false);

    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  if (!token || !showBell) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <button
        type="button"
        onClick={() => {
          unlockAudio();
          setIsOpen((previous) => !previous);
          fetchNotifications();
        }}
        title="Notifications"
        aria-label={`Notifications, ${unreadCount} unread`}
        style={{
          position: "relative",
          background: "transparent",
          border: "1px solid #475569",
          borderRadius: "8px",
          padding: "9px 12px",
          color: "inherit",
          cursor: "pointer",
          fontSize: "18px",
        }}
      >
        🔔

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-7px",
              right: "-7px",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              borderRadius: "20px",
              background: "#ef4444",
              color: "#fff",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notifications-dropdown"
          style={{
            position: "absolute",
            top: "45px",
            right: 0,
            width: "380px",
            maxWidth: "380px",
            minWidth: 0,
            maxHeight: "420px",
            overflow: "hidden",
            boxSizing: "border-box",
            background: "#111827",
            color: "#f8fafc",
            border: "1px solid #334155",
            borderRadius: "12px",
            boxShadow: "0 12px 35px rgba(0,0,0,0.35)",
            padding: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <strong>Notifications</strong>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#60a5fa",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div
            style={{
              maxHeight: "340px",
              overflowY: "auto",
              overflowX: "hidden",
              paddingRight: "5px",
            }}
          >
            {notifications.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: "13px" }}>
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 8px",
                    marginBottom: "6px",
                    border: 0,
                    borderRadius: "8px",
                    background: notification.isRead
                      ? "#1e293b"
                      : "#26364f",
                    color: "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  <strong style={{ fontSize: "13px" }}>
                    {notification.title}
                  </strong>

                  <p
                    style={{
                      margin: "5px 0",
                      fontSize: "12px",
                      color: "#cbd5e1",
                    }}
                  >
                    {notification.message}
                  </p>

                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {notification.createdAt
                      ? new Date(notification.createdAt).toLocaleString()
                      : ""}
                    {!notification.isRead ? " • New" : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
