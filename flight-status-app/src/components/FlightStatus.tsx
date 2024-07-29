"use client";

import { useQuery } from "@tanstack/react-query";
import { getFlightStatus } from "@/lib/api";
import { useEffect } from "react";
import { socket } from "@/lib/socket";

export default function FlightStatus() {
  const { data, refetch } = useQuery({
    queryKey: ["flightStatus"],
    queryFn: getFlightStatus,
  });

  useEffect(() => {
    socket.on("statusUpdate", () => {
      refetch();
    });

    return () => {
      socket.off("statusUpdate");
    };
  }, [refetch]);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="bg-white shadow-md rounded p-4 mb-4">
      <h2 className="text-xl font-semibold mb-2">Current Flight Status</h2>
      <p>Flight: {data.flight_number}</p>
      <p>Status: {data.status}</p>
      <p>Gate: {data.gate}</p>
      {data.delay >= 0 && (
        <p className="text-red-500">Delay: {data.delay} minutes</p>
      )}
    </div>
  );
}
