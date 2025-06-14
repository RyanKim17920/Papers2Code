import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import { useModal } from '../context/ModalContext';

const Modal: React.FC = () => {
  const { isModalOpen, modalOptions, hideModal } = useModal();

  if (!modalOptions) return null;

  return (
    <Dialog
      open={isModalOpen}
      onClose={hideModal}
      aria-labelledby="modal-dialog-title"
      aria-describedby="modal-dialog-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="modal-dialog-title">
        {modalOptions.title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="modal-dialog-description">
          {modalOptions.message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {modalOptions.actions.map((action, index) => (
          <Button
            key={index}
            onClick={action.onClick}
            color={action.color || 'primary'}
            variant={action.variant || 'text'}
          >
            {action.label}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
};

export default Modal;
