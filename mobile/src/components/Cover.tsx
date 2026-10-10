import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { swatch, useTheme } from "../theme";

export function mediaUri(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (typeof window !== "undefined" && url.startsWith("/")) return `${window.location.origin}${url}`;
  return url;
}

export function Cover({
  title,
  uri,
  width,
  height,
  radius = 8,
}: {
  title: string;
  uri?: string;
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const theme = useTheme();
  const resolved = mediaUri(uri);
  const [failed, setFailed] = useState(!resolved);
  useEffect(() => setFailed(!resolved), [resolved]);
  const letters = [...title].slice(0, 2).join("") || "日";
  if (resolved && !failed) {
    return (
      <Image
        source={{ uri: resolved }}
        style={{ width, height, borderRadius: radius, backgroundColor: theme.line }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: swatch(title),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: height > 100 ? 36 : 18, fontWeight: "600" }}>{letters}</Text>
    </View>
  );
}
