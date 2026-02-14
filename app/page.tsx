"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [title, setTitle] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) setBookmarks([]);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    getBookmarks();

    const channel = supabase
      .channel("bookmarks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookmarks" },
        () => getBookmarks(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getBookmarks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bookmarks")
      .select("*")
      .order("created_at", { ascending: false });
    setBookmarks(data ?? []);
  };

  const canAdd = title.trim() && url.trim() && !loading;

  const handleAddBookmark = async () => {
    if (!canAdd) return;
    setLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from("bookmarks").insert([
      {
        title: title,
        url: url,
        user_id: user.id,
      },
    ]);

    setLoading(false);
    if (insertError) return setError(insertError.message);

    setTitle("");
    setUrl("");
    getBookmarks();
  };

  const handleRemoveBookmark = async (bookmarkId: number) => {
    await supabase.from("bookmarks").delete().eq("id", bookmarkId);
    getBookmarks();
  };

  return (
    <div className="min-h-screen bg-gray-700 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg p-8 space-y-6 text-gray-500">
        {!user ? (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-semibold">Smart Bookmark App</h1>
            <button
              onClick={handleLogin}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer"
            >
              Login with Google
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <p className="text-sm">Logged in as</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition cursor-pointer"
              >
                Logout
              </button>
            </div>

            {/* Add Bookmark */}
            <div className="space-y-3">
              <h2 className="font-semibold text-lg">Add Bookmark</h2>

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                onClick={handleAddBookmark}
                disabled={!canAdd}
                className={`w-full py-2 rounded-lg text-white transition ${
                  canAdd
                    ? "bg-green-600 hover:bg-green-700 cursor-pointer"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {loading ? "Adding..." : "Add Bookmark"}
              </button>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {/* Bookmark List */}
            <div className="space-y-3">
              <h2 className="font-semibold text-lg">Your Bookmarks</h2>

              {bookmarks.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No bookmarks yet. Add your first one.
                </p>
              ) : (
                <ul className="space-y-1">
                  {bookmarks.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between border rounded-lg px-4 py-2 hover:bg-gray-50"
                    >
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-xs"
                      >
                        {b.title}
                      </a>

                      <button
                        onClick={() => handleRemoveBookmark(b.id)}
                        className="text-sm text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
