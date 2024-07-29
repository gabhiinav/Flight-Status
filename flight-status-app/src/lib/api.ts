import axios from "axios";
import { FlightStatus } from "@/types";

const api = axios.create({
  baseURL: "http://localhost:3001/api",
});

export async function getFlights() {
  const response = await api.get("/flights");
  return response.data;
}

export async function getFlightStatus(flightNumber: string) {
  const response = await api.get(`/flight-status/${flightNumber}`);
  return response.data;
}

export async function updateFlightStatus(status: {
  flight_number: string;
  status: string;
  gate: string;
  delay: number;
}) {
  const response = await api.post("/flight-status", status);
  return response.data;
}

export async function deleteFlight(flightNumber: string) {
  const response = await api.delete(`/flight-status/${flightNumber}`);
  return response.data;
}

export async function createUser(
  username: string
): Promise<{ id: number; username: string }> {
  const response = await api.post("/users", { username });
  return response.data;
}

export async function getSubscribedFlights(
  userId: number
): Promise<FlightStatus[]> {
  const response = await api.get(`/user-flights/${userId}`);
  return response.data;
}

export async function subscribeFlight(
  userId: number,
  flightNumber: string
): Promise<void> {
  await api.post("/subscribe", { userId, flightNumber });
}

export async function unsubscribeFlight(
  userId: number,
  flightNumber: string
): Promise<void> {
  await api.post("/unsubscribe", { userId, flightNumber });
}
