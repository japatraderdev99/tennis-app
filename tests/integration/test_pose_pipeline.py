"""Synthetic join tests; no real athlete labels or model packages are required."""
from copy import deepcopy
import hashlib
import json

import pytest

from tennis_backend.pose_pipeline import infer_pose_frames, prepare_pose_review, write_pose_review

NAMES = ('nose left_eye right_eye left_ear right_ear left_shoulder right_shoulder '
         'left_elbow right_elbow left_wrist right_wrist left_hip right_hip '
         'left_knee right_knee left_ankle right_ankle').split()


def media():
    return {
        'schema_version':'0.1.0','asset_id':'sha256:'+'a'*64,'sha256':'a'*64,
        'byte_size':100,'source_name':'synthetic.mp4','stream_index':0,
        'codec_name':'h264','coded_width':100,'coded_height':100,
        'sample_aspect_ratio':'1/1','rotation_degrees':0.0,'time_base':'1/1000',
        'duration_seconds':0.04,'nominal_fps':50.0,'average_fps':50.0,
        'frames':[{'frame_index':0,'pts':100,'time_seconds':0.1},
                  {'frame_index':1,'pts':120,'time_seconds':0.12}],
        'quality_reasons':[],'timing_basis':'original_pts',
        'temporal_resolution':'not_established','tool':{'name':'ffprobe','version':'synthetic'},
    }


class FakeAdapter:
    def __init__(self):
        self.calls=[]

    def infer(self, image_bgr, *, frame_index, pts, time_base):
        self.calls.append((frame_index,pts,time_base))
        return {'frame_index':frame_index,'pts':pts,'display_width':100,'display_height':100,
            'detections':[{'detection_id':'d0','bbox':{'x1':10.0,'y1':10.0,'x2':50.0,'y2':90.0},
                'keypoints':[{'name':name,'x':20.0,'y':30.0,'score':None,
                             'visibility':0.9,'presence':0.9} for name in NAMES]}]}

    def provenance(self):
        return {'kind':'model_inference','adapter':'mediapipe','adapter_version':'synthetic-test',
                'model_files':[{'role':'synthetic','sha256':'b'*64}],
                'runtime':{'test':'fake adapter; no inference'},'parameters':{},'transforms':[]}


def artifact():
    return infer_pose_frames(media(),FakeAdapter(),[(0,None),(1,None)],transforms=['synthetic identity'])


def test_join_keeps_original_nonzero_pts():
    adapter=FakeAdapter()
    result=infer_pose_frames(media(),adapter,[(0,None),(1,None)],transforms=['synthetic identity'])
    assert adapter.calls==[(0,100,'1/1000'),(1,120,'1/1000')]
    assert [r['pts'] for r in result['frames']]==[100,120]
    assert result['provenance']['kind']=='model_inference'
    assert result['validation_ref'] is None
    assert result['measurement_status']=='research_only'


@pytest.mark.parametrize('indices', [[1,0],[0,0],[2],[True],[-1]])
def test_invalid_frame_join(indices):
    with pytest.raises(ValueError):
        infer_pose_frames(media(),FakeAdapter(),[(i,None) for i in indices],transforms=['identity'])


@pytest.mark.parametrize('limit',[True,0,-1,1.0])
def test_invalid_budget(limit):
    with pytest.raises(ValueError):
        infer_pose_frames(media(),FakeAdapter(),[(0,None)],transforms=['identity'],max_frames=limit)


def test_budget_fails_without_truncated_success():
    adapter=FakeAdapter()
    with pytest.raises(ValueError,match='pose_frame_limit'):
        infer_pose_frames(media(),adapter,[(0,None),(1,None)],transforms=['identity'],max_frames=1)
    assert len(adapter.calls)==1


@pytest.mark.parametrize('transforms',[[],[''],[1],None])
def test_explicit_display_transform(transforms):
    with pytest.raises(ValueError):
        infer_pose_frames(media(),FakeAdapter(),[(0,None)],transforms=transforms)


def test_empty_sequence_is_not_success():
    with pytest.raises(ValueError,match='empty_pose_sequence'):
        infer_pose_frames(media(),FakeAdapter(),[],transforms=['identity'])


@pytest.mark.parametrize('field,value',[('pts',101),('frame_index',1),('pts',True)])
def test_adapter_cannot_change_source_evidence(field,value):
    class BadAdapter(FakeAdapter):
        def infer(self,*args,**kwargs):
            row=super().infer(*args,**kwargs)
            row[field]=value
            return row
    with pytest.raises(ValueError,match='adapter_evidence_mismatch'):
        infer_pose_frames(media(),BadAdapter(),[(0,None)],transforms=['identity'])


def test_review_is_unreviewed_and_has_no_accuracy():
    bundle=prepare_pose_review(artifact(),seed_frame_index=0,seed_detection_id='d0')
    assert bundle['selection']['asset_id']==bundle['poses']['asset_id']
    assert all(r['status']=='selected' for r in bundle['selection']['frames'])
    assert bundle['annotations']['review_status']=='unreviewed'
    assert all(k['x'] is None and k['y'] is None
               for f in bundle['annotations']['frames'] for k in f['keypoints'])
    assert bundle['evaluation']['status']=='not_evaluated'
    assert bundle['evaluation']['mean_error_px'] is None
    assert bundle['evaluation']['coverage'] is None
    assert 'report' not in bundle


def test_write_requires_new_directory_and_verifiable_checksums(tmp_path):
    bundle=prepare_pose_review(artifact(),seed_frame_index=0,seed_detection_id='d0')
    destination=tmp_path/'review'
    hashes=write_pose_review(bundle,destination)
    assert json.loads((destination/'checksums.json').read_text())==hashes
    assert all(hashlib.sha256((destination/name).read_bytes()).hexdigest()==digest
               for name,digest in hashes.items())
    with pytest.raises(FileExistsError): write_pose_review(bundle,destination)


def test_nonfinite_serialization_never_marks_complete(tmp_path):
    bundle={'poses':{'bad':float('nan')},'selection':{},'annotations':{},'evaluation':{}}
    with pytest.raises(ValueError): write_pose_review(bundle,tmp_path/'invalid')
    assert not (tmp_path/'invalid').exists()
