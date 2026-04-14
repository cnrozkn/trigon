import { Composition } from "remotion";
import { TrigonAd } from "./TrigonAd";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="TrigonAd"
        component={TrigonAd}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
