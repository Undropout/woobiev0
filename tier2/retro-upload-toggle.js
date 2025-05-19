document.addEventListener('DOMContentLoaded', () => {
    const uploadLabels = [
      document.querySelector('label[for="image-file"]'),
      document.querySelector('label[for="audio-file"]')
    ];
  
    uploadLabels.forEach(label => {
      if (label) {
        label.addEventListener('click', () => {
          label.classList.add('clicked');
          setTimeout(() => label.classList.remove('clicked'), 200);
        });
      }
    });
  });
  