import { supabase } from "./App.tsx";





//const url =  import.meta.env.VITE_SUPABASE_URL;
//const key = import.meta.env.VITE_SUPABASE_KEY;
//console.log(url)


interface Props {
  onLogin: () => void;
}
//code
export default function LoginScreen({ onLogin }: Props) {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (!error) onLogin();
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "10vh auto", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>Admin Login</h2>
      <button onClick={handleGoogleLogin} style={{ width: "100%", padding: "0.75rem" }}>
        Login with Google
      </button>
    </div>
  );
}
//code