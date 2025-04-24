import { useEffect, useState, type JSX } from "react";
import { createClient, PostgrestSingleResponse } from "@supabase/supabase-js";
import {
  GoogleMap,
  Marker,
  useLoadScript,
} from "@react-google-maps/api";
import type { Database } from "../database.types.ts";
import LoginScreen from "./login_screen.tsx";


type ParkingData = Database["public"]["Tables"]["parking_restrictions"]["Row"];
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

const mapContainerStyle = {
  width: "75vw",
  height: "100vh",
};

const center = {
  lat: 51.5074,
  lng: -0.1278,
};

const google_key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const editableFields = [
  "Road Name",
  "Restriction Type",
  "Controlled Parking Zone",
  "Times Of Operation",
  "Maximum Stay",
  "Nearest Machine",
  "Notes",
  "Parking Spaces",
  "Postcode",
  "Valid Parking Permits"
] as const;

export default function AdminMap(): JSX.Element {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: google_key,
  });

  const [role, setRole] = useState<string | null>(null);
  const [allData, setAllData] = useState<ParkingData[]>([]);
  const [pendingData, setPendingData] = useState<ParkingData[]>([]);
  const [formState, setFormState] = useState<Record<string, Partial<ParkingData>>>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(center);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (role === "admin") {
      fetchData();
      const channel = supabase
        .channel("parking_restrictions")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "parking_restrictions" },
          (payload) => {
            if (payload.eventType === "DELETE" || payload.eventType === "UPDATE") {
              fetchData();
              if (payload.old?.id === selectedItemId) {
                setSelectedItemId(null);
              }
            }
            if (payload.eventType === "INSERT") {
              fetchData();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [role]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      setRole(data?.role || null);
    }
  }

  async function fetchData(): Promise<void> {
    const { data, error }: PostgrestSingleResponse<ParkingData[]> = await supabase
      .from("parking_restrictions")
      .select("*");
    if (!error && data) {
      setAllData(data);
      setPendingData(data.filter((item) => item.status === "pending"));
    }
  }

  async function updateData(id: string, changes: Partial<ParkingData>): Promise<void> {
    await supabase.from("parking_restrictions").update(changes).eq("id", id);
    setSelectedItemId(null);
    fetchData();
  }

  async function deleteData(id: string): Promise<void> {
    await supabase.from("parking_restrictions").delete().eq("id", id);
    setSelectedItemId(null);
    fetchData();
  }

  if (!isLoaded) return <div>Loading...</div>;
  if (!role) return <LoginScreen onLogin={checkUser} />;
  if (role !== "admin") return <div>Access denied. Admins only.</div>;

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <h2>Pending Approvals</h2>
        {pendingData.map((item) => (
          <div
            key={item.id}
            className="pending-card"
            onClick={() => {
              setSelectedItemId(item.id);
              setMapCenter({ lat: item.Latitude, lng: item.Longitude });
            }}
          >
            <p><strong>Road:</strong> {item["Road Name"]}</p>
            <p><strong>Type:</strong> {item["Restriction Type"]}</p>
            <p><strong>Zone:</strong> {item["Controlled Parking Zone"]}</p>
            <p><strong>Times:</strong> {item["Times Of Operation"]}</p>

            {selectedItemId === item.id && (
              <div className="edit-box">
                <h4>Edit & Approve</h4>
                {editableFields.map((field) => (
                  <input
                    key={field}
                    className="input-field"
                    placeholder={field}
                    value={(formState[item.id]?.[field as keyof ParkingData] as string) ?? (item[field as keyof ParkingData] as string) ?? ""}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], [field]: e.target.value },
                      }))
                    }
                  />
                ))}
                {item["Image URL"] && (
                  <img
                    src={item["Image URL"]}
                    alt="parking"
                    className="image-preview"
                  />
                )}
                <button
                  onClick={() => {
                    const changes = {
                      ...formState[item.id],
                      status: "approved" as Database["public"]["Enums"]["restriction_status"],
                      approved_at: new Date().toISOString(),
                    };
                    updateData(item.id, changes);
                  }}
                >
                  Save & Approve
                </button>
                <button onClick={() => deleteData(item.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </aside>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={15}
        center={mapCenter}
      >
        {allData.map((item) => (
          <Marker
            key={item.id}
            position={{ lat: item.Latitude, lng: item.Longitude }}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
