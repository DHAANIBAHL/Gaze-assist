clc;
clear;
close all;

rootData = 'C:\Users\namra\MPIIGaze\Data\Normalized';
rootAnno = 'C:\Users\namra\MPIIGaze\Evaluation Subset\annotation for face image';

imgSize = [64 64];   % CNN-friendly
X = [];
Y = [];



subjects = dir(fullfile(rootData,'p*'));
subjects = subjects([subjects.isdir]);

for s = 1:length(subjects)

    subj = subjects(s).name;
    subjPath = fullfile(rootData,subj);

    % ---- Load annotation file ----
    annoFile = fullfile(rootAnno,[subj '.txt']);
    gazeAnno = readmatrix(annoFile);

    dayFiles = dir(fullfile(subjPath,'Day*.mat'));

    annoIdx = 1;  % annotation pointer
    for d = 1:length(dayFiles)

        matPath = fullfile(subjPath,dayFiles(d).name);
        S = load(matPath);

        if ~isfield(S,'data')
            continue;
        end
        eyes = {'right','left'};

        for e = 1:2
            eyeStruct = S.data.(eyes{e});

            fn = fieldnames(eyeStruct);

            % find image tensor field
            imgField = '';
            for k = 1:length(fn)
                val = eyeStruct.(fn{k});
                if isnumeric(val) && ndims(val) == 3
                    imgField = fn{k};
                    break;
                end
            end

            if isempty(imgField)
                continue;
            end

            imgs = eyeStruct.(imgField);
            for i = 1:size(imgs,3)

                if annoIdx > size(gazeAnno,1)
                    break;
                end

                img = imgs(:,:,i);
                img = imresize(img,imgSize);
                img = im2double(img);

                X(:,:,end+1) = img;

                % Annotation format: [pitch yaw]
                Y(end+1,:) = gazeAnno(annoIdx,1:2);

                annoIdx = annoIdx + 1;
            end
        end
    end
end
disp(size(X))
disp(size(Y))

save('MPIIGaze_X.mat','X','-v7.3')
save('MPIIGaze_Y.mat','Y')
load MPIIGaze_X.mat
load MPIIGaze_Y.mat

imshow(X(:,:,1),[])
title(num2str(Y(1,:)))
