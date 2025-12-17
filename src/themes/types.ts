export interface Theme {
  id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    border: string;
    primary: string;
    secondary: string;
    accent: string;
    sidebar: {
      bg: string;
      border: string;
      text: string;
      active: string;
      hover: string;
    };
    statusBar: {
      bg: string;
      border: string;
      text: string;
    };
    card: {
      bg: string;
      border: string;
      text: string;
    };
    input: {
      bg: string;
      border: string;
      text: string;
      placeholder: string;
      focus: string;
    };
    button: {
      primary: string;
      primaryHover: string;
      secondary: string;
      secondaryHover: string;
    };
    scrollbar: {
      track: string;
      thumb: string;
      thumbHover: string;
    };
    menubar: {
      bg: string;
      border: string;
      text: string;
      hover: string;
      active: string;
      activeText: string;
      dropdown: {
        bg: string;
        border: string;
        text: string;
        hover: string;
        separator: string;
      };
      controls: {
        text: string;
        hover: string;
      };
    };
  };
}

