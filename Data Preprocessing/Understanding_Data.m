clc;
clear;

sampleFile = 'C:\Users\namra\MPIIGaze\Data\Normalized\p00\Day01.mat';
data = load(sampleFile);
whos('-file', sampleFile)

S = load('C:\Users\namra\MPIIGaze\Data\Normalized\p00\Day01.mat');
fieldnames(S.data)

size(S.data.right)
size(S.data.left)



class(S.data.right)
class(S.data.left)