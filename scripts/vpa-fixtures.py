from pathlib import Path
from pptx import Presentation
root=Path.home()/'.urp_app'
deck=Presentation()
for title,body in [('DEMO TEST - VPA workflow','Synthetic presentation for app validation only. Not a student submission.'),('DEMO TEST - evidence','Example observation: a tactile display invites product comparison.\nThis fixture tests file upload, preview and packaging.')]:
    slide=deck.slides.add_slide(deck.slide_layouts[1]);slide.shapes.title.text=title;slide.placeholders[1].text=body
    slide.notes_slide.notes_text_frame.text='DEMO TEST - no real student analysis or grading data.'
deck.save(root/'vpa-demo-slides.pptx')
print('Two-slide synthetic PowerPoint generated outside OneDrive.')
