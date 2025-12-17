import { useMenuActions } from '../hooks/useMenuActions';

const MenuHandler: React.FC = () => {
  useMenuActions();

  return null; // Ce composant ne rend rien
};

export default MenuHandler;

