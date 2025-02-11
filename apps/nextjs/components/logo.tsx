export const Logo = ({
  className = "",
  fill = "currentColor",
}: {
  className?: string;
  fill?: string;
}) => (
  <svg
    viewBox="0 0 500 800"
    fill="red"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M0 413V325L500 519V607L0 800V712L402.081 562.974L0 413Z"
      fill={fill}
    />
    <path
      d="M500 88L97.9186 237.974L500 387V475L0 282V194L500 0V88Z"
      fill={fill}
    />
  </svg>
);
