/** The supplied robot, cut out onto a transparent background and served locally. */
export function RobotAvatar({ imageSrc }: { imageSrc?: string }) {
  return <img className="orbit-avatar" src={imageSrc ?? "/images/orbit-companion.png"} alt="" width={100} height={103} draggable={false} />;
}
