"use client";

import { useState, useEffect } from "react";
import { getFlights, updateFlightStatus, deleteFlight } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function AdminPage() {
  const [flights, setFlights] = useState([]);
  const [flightNumber, setFlightNumber] = useState("");
  const [status, setStatus] = useState("");
  const [gate, setGate] = useState("");
  const [delay, setDelay] = useState(0);

  const { data: flightData, refetch } = useQuery({
    queryKey: ["flights"],
    queryFn: getFlights,
  });

  useEffect(() => {
    if (flightData) {
      setFlights(flightData);
    }
  }, [flightData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateFlightStatus({
        flight_number: flightNumber,
        status,
        gate,
        delay,
      });
      alert("Flight status updated successfully");
      refetch();
      // Clear form
      setFlightNumber("");
      setStatus("");
      setGate("");
      setDelay(0);
    } catch (error) {
      console.error("Failed to update flight status:", error);
      alert("Failed to update flight status");
    }
  };

  const handleDelete = async (flightNumber: string) => {
    if (
      window.confirm(`Are you sure you want to delete flight ${flightNumber}?`)
    ) {
      try {
        await deleteFlight(flightNumber);
        alert("Flight deleted successfully");
        refetch();
      } catch (error) {
        console.error("Failed to delete flight:", error);
        alert("Failed to delete flight");
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Flight Status Admin</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Current Flights</h2>
        <table className="w-full border-collapse border">
          <thead>
            <tr>
              <th className="border p-2">Flight Number</th>
              <th className="border p-2">Status</th>
              <th className="border p-2">Gate</th>
              <th className="border p-2">Delay</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {flights.map((flight) => (
              <tr key={flight.flight_number}>
                <td className="border p-2">{flight.flight_number}</td>
                <td className="border p-2">{flight.status}</td>
                <td className="border p-2">{flight.gate}</td>
                <td className="border p-2">{flight.delay} minutes</td>
                <td className="border p-2">
                  <button
                    onClick={() => handleDelete(flight.flight_number)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold mb-2">Add/Update Flight</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block">Flight Number:</label>
          <input
            type="text"
            value={flightNumber}
            onChange={(e) => setFlightNumber(e.target.value)}
            className="border p-2 w-full"
            required
          />
        </div>
        <div>
          <label className="block">Status:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border p-2 w-full"
            required
          >
            <option value="">Select status</option>
            <option value="On Time">On Time</option>
            <option value="Delayed">Delayed</option>
            <option value="Boarding">Boarding</option>
            <option value="Departed">Departed</option>
            <option value="Arrived">Arrived</option>
          </select>
        </div>
        <div>
          <label className="block">Gate:</label>
          <input
            type="text"
            value={gate}
            onChange={(e) => setGate(e.target.value)}
            className="border p-2 w-full"
            required
          />
        </div>
        <div>
          <label className="block">Delay (minutes):</label>
          <input
            type="number"
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            className="border p-2 w-full"
            min="0"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add/Update Flight
        </button>
      </form>
    </div>
  );
}
