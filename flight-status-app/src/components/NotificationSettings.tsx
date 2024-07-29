"use client";

import { useState } from "react";
import { updateNotificationSettings } from "@/lib/api";

export default function NotificationSettings() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateNotificationSettings({ email, phone, pushEnabled });
    alert("Notification settings updated!");
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-md rounded p-4">
      <h2 className="text-xl font-semibold mb-2">Notification Settings</h2>
      <div className="mb-4">
        <label className="block mb-2">Email:</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-2">Phone (for SMS):</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={(e) => setPushEnabled(e.target.checked)}
            className="mr-2"
          />
          Enable push notifications
        </label>
      </div>
      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Save Settings
      </button>
    </form>
  );
}
