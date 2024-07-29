"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSubscribedFlights,
  subscribeFlight,
  unsubscribeFlight,
  createUser,
  getFlights,
} from "@/lib/api";
import { urlBase64ToUint8Array } from "@/lib/pushNotificationHelper";
import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { FlightStatus } from "@/types";

export default function Home() {
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const queryClient = useQueryClient();

  const { data: allFlights } = useQuery({
    queryKey: ["allFlights"],
    queryFn: getFlights,
  });

  const { data: subscribedFlights } = useQuery({
    queryKey: ["subscribedFlights", userId],
    queryFn: () =>
      userId ? getSubscribedFlights(userId) : Promise.resolve([]),
    enabled: !!userId,
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      setUserId(data.id);
      localStorage.setItem("userId", data.id.toString());
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: ({
      userId,
      flightNumber,
    }: {
      userId: number;
      flightNumber: string;
    }) => subscribeFlight(userId, flightNumber),
    onSuccess: () => {
      queryClient.invalidateQueries(["subscribedFlights", userId]);
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: ({
      userId,
      flightNumber,
    }: {
      userId: number;
      flightNumber: string;
    }) => unsubscribeFlight(userId, flightNumber),
    onSuccess: () => {
      queryClient.invalidateQueries(["subscribedFlights", userId]);
    },
  });

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(parseInt(storedUserId, 10));
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      requestNotificationPermission();
    }
  }, [userId]); // Add userId as a dependency

  async function requestNotificationPermission() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        console.log("Notification permission granted.");
        registerServiceWorker();
      } else {
        console.log("Notification permission denied.");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  }

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js"
      );
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const vapidPublicKeyResponse = await fetch("/api/vapid-public-key");
        const vapidPublicKey = await vapidPublicKeyResponse.json();
        const convertedVapidKey = urlBase64ToUint8Array(
          vapidPublicKey.publicKey
        );
        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
        await fetch("/api/save-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: userId,
            subscription: newSubscription,
          }),
        });
        console.log("Push notification subscription saved.");
      }
    } catch (error) {
      console.error("Error registering service worker:", error);
    }
  }

  useEffect(() => {
    const handleStatusUpdate = (updatedFlight: FlightStatus) => {
      queryClient.setQueryData<FlightStatus[]>(
        ["subscribedFlights", userId],
        (oldData) => {
          if (!oldData) return oldData;
          const index = oldData.findIndex(
            (f) => f.flight_number === updatedFlight.flight_number
          );
          if (index !== -1) {
            const newData = [...oldData];
            newData[index] = updatedFlight;
            return newData;
          }
          return oldData;
        }
      );
    };

    const handleFlightDeleted = (flightNumber: string) => {
      queryClient.setQueryData<FlightStatus[]>(
        ["subscribedFlights", userId],
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.filter((f) => f.flight_number !== flightNumber);
        }
      );
    };

    socket.on("statusUpdate", handleStatusUpdate);
    socket.on("flightDeleted", handleFlightDeleted);

    return () => {
      socket.off("statusUpdate", handleStatusUpdate);
      socket.off("flightDeleted", handleFlightDeleted);
    };
  }, [userId, queryClient]);

  const handleCreateUser = () => {
    if (username) {
      createUserMutation.mutate(username);
    }
  };

  const handleSubscribe = (flightNumber: string) => {
    if (userId) {
      subscribeMutation.mutate({ userId, flightNumber });
    }
  };

  const handleUnsubscribe = (flightNumber: string) => {
    if (userId) {
      unsubscribeMutation.mutate({ userId, flightNumber });
    }
  };

  if (!userId) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Create User</h1>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          className="border p-2 mr-2"
        />
        <button
          onClick={handleCreateUser}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Create User
        </button>
      </div>
    );
  }

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Subscribed Flights</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subscribedFlights?.map((flight) => (
          <div
            key={flight.flight_number}
            className="bg-white shadow-md rounded p-4"
          >
            <h2 className="text-xl font-semibold mb-2">
              Flight {flight.flight_number}
            </h2>
            <p>Status: {flight.status}</p>
            <p>Gate: {flight.gate}</p>
            {flight.delay > 0 && (
              <p className="text-red-500">Delay: {flight.delay} minutes</p>
            )}
            <button
              onClick={() => handleUnsubscribe(flight.flight_number)}
              className="mt-2 bg-red-500 text-white px-2 py-1 rounded"
            >
              Unsubscribe
            </button>
          </div>
        ))}
      </div>
      <h2 className="text-xl font-bold mt-8 mb-4">All Available Flights</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allFlights?.map((flight) => (
          <div
            key={flight.flight_number}
            className="bg-white shadow-md rounded p-4"
          >
            <h2 className="text-xl font-semibold mb-2">
              Flight {flight.flight_number}
            </h2>
            <p>Status: {flight.status}</p>
            <p>Gate: {flight.gate}</p>
            {flight.delay > 0 && (
              <p className="text-red-500">Delay: {flight.delay} minutes</p>
            )}
            <button
              onClick={() => handleSubscribe(flight.flight_number)}
              className="mt-2 bg-green-500 text-white px-2 py-1 rounded"
            >
              Subscribe
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
