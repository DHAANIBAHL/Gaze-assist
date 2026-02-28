clc;
clear;
close all;

root ='C:\Users\namra\MPIIGaze\Data\Normalized';   % CHANGE PATH
imgSize = [64 64];


X = [];
Y = [];

subs = dir(fullfile(root,'p*'));
subs = subs([subs.isdir]);

for s = 1:length(subs)
    subjPath = fullfile(root, subs(s).name);
    dayFiles = dir(fullfile(subjPath,'Day*.mat'));

    for d = 1:length(dayFiles)
        S = load(fullfile(subjPath, dayFiles(d).name));

        eyes = {'right','left'};

        for e = 1:2
            E = S.data.(eyes{e});

            imgs = E.image;   % 995 × 36 × 60
            gaze = E.gaze;    % 995 × 3

            N = size(imgs,1);

            for i = 1:N
                img = squeeze(imgs(i,:,:));  % 36×60
                img = imresize(img, imgSize);
                img = im2double(img);

                X(:,:,end+1) = img;
                Y(end+1,:) = gaze(i,:);
            end
        end
    end
end

disp('Final dataset size:')
disp(size(X))
disp(size(Y))

save('X_mpiigaze_normalized.mat','X','-v7.3')
save('Y_mpiigaze_gaze.mat','Y')
